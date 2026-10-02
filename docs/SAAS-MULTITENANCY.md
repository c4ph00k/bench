# Architettura — PostgreSQL e multi-tenancy

**Stato:** migrazione da SQLite a PostgreSQL implementata. Le funzionalità di piattaforma
ancora previste sono elencate nella sezione 6.
**Scopo:** documentare il modello dati, l'identità e l'isolamento dei tenant attualmente nel codice.

Bench usa un unico database PostgreSQL per auth, CRM, Space e Rolodex. PostgreSQL è stato
adottato per superare la precedente architettura con file SQLite separati e supportare
un'applicazione multi-tenant con accesso concorrente. L'esecuzione locale resta possibile,
ma non implica più un solo utente o un database per applicazione.

## 1. Identità e membership

Lo schema globale è definito in `server/migrations/0001_global_domain.sql`:

- `users`: identità globale, email univoca, password con hash scrypt, flag `master_admin`,
  `must_change_password` e `token_version`.
- `tenants`: organizzazioni, con id numerico `bigint`, nome, slug univoco, stato e piano.
- `memberships`: relazione tra utente e tenant, con chiave `(tenant_id, user_id)` e ruolo
  `owner`, `admin` o `user`.

Il ruolo appartiene alla membership: lo stesso utente può avere ruoli diversi in tenant diversi.
Il ruolo vale per tutte e tre le app; non esiste una matrice di permessi per-app.

Il pannello `/admin` consente a owner e admin di gestire i membri del tenant. Il backend impedisce
la rimozione della propria membership e la rimozione o demozione dell'ultimo owner. La distinzione
più fine proposta in origine, con poteri esclusivi dell'owner su impostazioni e piano del tenant,
non è attualmente implementata dal pannello.

Le sessioni sono JWT HS256 firmati con `JWT_SECRET`, trasportati in un cookie `httpOnly` e
`SameSite=Lax`. Il token identifica l'utente, non il tenant. A ogni richiesta il server verifica
la firma e confronta il `token_version` con il valore nel database: logout e cambio/reset password
invalidano i token precedenti. Non esiste una tabella `sessions` nel modello attuale.

## 2. Tenant attivo e isolamento

`server/src/tenant.ts` risolve il tenant per ogni richiesta autenticata:

- Se è presente `X-Tenant-Id`, verifica che l'utente abbia una membership nel tenant indicato.
- Un utente con il flag globale `master_admin` può indicare qualunque tenant esistente.
- In assenza dell'header usa il tenant della prima membership dell'utente.
- Se non è possibile autorizzare il tenant, la richiesta riceve 403.

La barra di navigazione include uno switcher per il master admin quando esiste più di un tenant.
`GET /api/auth/tenants` restituisce i tenant disponibili; il client salva la scelta in
`localStorage` e invia `X-Tenant-Id` nelle richieste. Gli slug identificano i tenant nel database,
ma le app restano ai percorsi `/crm`, `/space` e `/rolodex`, senza routing `/t/:slug`.

### Tabelle operative

Tutte le tabelle operative hanno `tenant_id NOT NULL` con riferimento a `tenants`:

| Dominio | Tabelle                                                                                           | Migrazione         |
| ------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| CRM     | `organizations`, `contacts`, `deals`, `activities`                                                | `0002_crm.sql`     |
| Space   | `pages`, `blocks`, `properties`, `property_options`, `row_values`, `views`                        | `0003_space.sql`   |
| Rolodex | `people`, `interactions`, `important_dates`, `facts`, `news`, `reminders`, `gifts`, `connections` | `0004_rolodex.sql` |

Il data layer usa query asincrone tramite `pg` e include lo scoping per tenant anche sulle tabelle
figlie. I parametri SQL usano la sintassi PostgreSQL (`$1`, `$2`, ecc.). Il dominio globale di
identità non ha una policy RLS per tenant.

### Row-Level Security

`server/migrations/0005_rls.sql` abilita RLS sulle tabelle operative e crea il ruolo `app_rls`.
`server/src/db/rls.ts` apre una connessione e una transazione per richiesta, imposta il ruolo
e il tenant con `SET LOCAL`, e passa la connessione ai router:

```sql
BEGIN;
SET LOCAL ROLE app_rls;
SET LOCAL app.tenant_id = '123';
```

Le policy di lettura e scrittura confrontano `tenant_id` con
`current_setting('app.tenant_id', true)::bigint`. Un id di tenant è numerico, non UUID;
sono invece UUID gli id di pagine e blocchi di Space.

La transazione viene confermata alla conclusione di una risposta con stato inferiore a 500,
oppure annullata in caso di errore 5xx o connessione interrotta. L'importazione Rolodex usa un
savepoint nella transazione della richiesta per evitare importazioni parziali.

RLS protegge le query eseguite come `app_rls`; non sostituisce i filtri nel data layer.
Le connessioni globali e di bootstrap usano il pool senza questa restrizione.

## 3. Migrazioni e avvio

`server/src/db/migrate.ts` applica i file SQL numerati in `server/migrations/` in ordine,
registra quelli eseguiti in `schema_migrations` e serializza il processo con un advisory lock.
Ogni file è eseguito nella propria transazione. Le modifiche di schema vanno in nuove migrazioni,
non in controlli ad hoc nel CRUD delle app.

`server/src/index.ts` crea il pool PostgreSQL, applica le migrazioni e crea il tenant `novhora`
e il suo owner al primo avvio. I seed delle tre app aggiungono dati dimostrativi a quel tenant
quando assenti. Il bootstrap di un tenant di esempio non è un provisioning SaaS self-service.

Configurazione richiesta: `DATABASE_URL` e `JWT_SECRET`. `PORT`, `SEED_EMAIL` e `SEED_PASSWORD`
configurano porta e account iniziale. Il TTL dei JWT è un'opzione del router auth; l'entry point
non legge una variabile `JWT_TTL`.

Il repository contiene solo `.env.example`, con placeholder. Il `.env` reale è gitignorato e
rimane gestito da Marco: l'agente non lo legge, crea o modifica.

## 4. Test

I test server usano PostgreSQL avviato con testcontainers; non usano database SQLite in memoria.
`server/test/helpers/postgres.ts` gestisce il pool e le migrazioni per il processo di test.
Le suite applicative verificano anche lo scoping tra tenant;
`server/test/infra/rls.test.ts` verifica l'isolamento RLS e
`server/test/infra/migrate.test.ts` il migratore.

Ogni worker Playwright avvia un proprio container PostgreSQL e un server con `DATABASE_URL`
dedicato, alla porta `8150 + workerIndex`. Il server migra e carica i seed al boot.
Docker deve essere in esecuzione per `npm test`, `npm run check` e `npm run e2e`.

## 5. Esecuzione e container

`npm run dev` avvia API su :8100 e Vite su :8101; `npm start` costruisce il frontend e serve
le app da :8100, con un PostgreSQL raggiungibile tramite `DATABASE_URL`.

`docker-compose.yml` definisce un container applicativo Node/Express e uno PostgreSQL 17,
con volume `postgres-data` persistente e healthcheck del database. Il `Dockerfile` costruisce
il frontend e include codice server e migrazioni nell'immagine.

I dati operativi non risiedono nel filesystem del container applicativo. Il vecchio manuale
SQLite con volume Cloud Storage FUSE è stato ritirato: non descrive questo deployment.

## 6. Funzionalità previste, ancora da completare

Il modello dati e l'isolamento multi-tenant sono implementati; non equivalgono a una piattaforma
SaaS completa. Restano da definire o realizzare:

- Provisioning automatico delle organizzazioni.
- Gestione di piattaforma per creazione/sospensione dei tenant e assegnazione del flag master admin.
  Lo stato `suspended` esiste nello schema, ma il resolver attuale non lo applica come blocco.
- Audit dell'impersonificazione del master admin.
- Billing, quote e feature per piano: `tenants.plan` è attualmente un campo del modello.
- Permessi per-app, import/export tra tenant e strategia di backup/ripristino per il deployment.

Le tre difese da mantenere sono `tenant_id` su ogni tabella operativa, scoping in ogni query del
data layer e RLS sulla connessione della richiesta.
