# Design document — SaaS multitenancy

**Stato:** proposta, non ancora implementata.
**Scopo:** definire il modello di tenancy, il modello di identità e il piano di migrazione
del data layer da SQLite a Postgres, in vista di un servizio SaaS multitenant.

Questo documento descrive il _dove_ arriva il prodotto, non il codice attuale. Oggi Bench è
local-first: un processo, quattro database SQLite, un solo utente seed `marco`. Le decisioni qui
sono la pietra che serve prima di toccare una sola query.

## Decisioni già prese (input)

- **Tenancy a schema condiviso**: una singola istanza Postgres, tutte le tabelle applicative
  condividono il database, ognuna con una colonna `tenant_id` per la separazione logica, più
  Row-Level Security come rete di sicurezza.
- **Ruolo dentro la membership**: un utente appartiene a un tenant con un _ruolo in quella
  membership_, non utente-per-tenant. Lo stesso utente può essere `owner` di un tenant e `user` in
  un altro.
- **Tre ruoli** bastano: `admin`, `owner`, `user`. (Il quarto ruolo, `master_admin`, è globale e
  non appartiene a una membership — vedi sotto.)
- **Un utente può appartenere a più tenant** (es. un utente "gold").
- **Master admin**: dominio globale, con un tenant-switcher; quando entra in un tenant opera
  esattamente come un `admin` di quel tenant (impersonificazione), e gestisce la piattaforma
  (creare/sospendere tenant, azzerare password, assegnare il flag di master admin).
- **Pipeline per tenant**: le `deals` (tutte le risorse operative, in verità) sono isolate per
  tenant. Mai pipeline condivise o miste.

## 1. Identità e tenancy

### 1.1 Il dominio globale

Due concetti separano la piattaforma dai dati operativi.

```
users  (dominio globale)
├── id
├── email                   UNIQUE
├── password_hash           scrypt, salato (vedi §4.3)
├── master_admin            boolean   — il flag che dà lo switcher e i privilegi di piattaforma
├── must_change_password    boolean
├── token_version           integer   — incrementato a ogni cambio/reset password, invalida i JWT
├── created_at / updated_at

tenants  (dominio globale)
├── id
├── name
├── slug                    UNIQUE   — per il routing/URL del tenant
├── status                  'active' | 'suspended'
├── plan                    text     — il grado di "gold" ecc., da tenere leggero al primo giro
├── created_at / updated_at

memberships  (la cerniera globale)
├── tenant_id       FK → tenants
├── user_id         FK → users
├── role            'owner' | 'admin' | 'user'
├── created_at
└── PRIMARY KEY (tenant_id, user_id)
```

`memberships` porta il ruolo _dentro la relazione_, non sull'utente. È esattamente il "ruolo nella
membership" confermato sopra: lo stesso `user_id` può righe diverse su `tenant_id` diversi con ruoli
diversi.

### 1.2 I tre ruoli di membership

| Ruolo   | Dentro il proprio tenant                                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner` | Tutto ciò che fa `admin`, più: cambiare nome/piano del tenant, vedere e sospendere gli altri membri, nominare/rimuovere `admin`. L'invariante "ultimo owner non può essere rimosso/demolito" sostituisce l'attuale "ultimo admin". |
| `admin` | Gestione piena dei dati operativi del tenant (CRM, Space, Rolodex) e degli utenti `user` del tenant. Non può demolire `owner` né toccare il tenant stesso.                                                                         |
| `user`  | Uso dei dati operativi del tenant secondo i permessi dell'app; nessuna gestione di membri o impostazioni.                                                                                                                          |

Le tre app (CRM, Space, Rolodex) restano un unico tenant logico: chi è in un tenant vede le _sue_
pipeline, pagine e contatti, non importa da quale app entra. Non c'è un ruolo _per app_ al primo
giro.

### 1.3 Master admin (globale)

`users.master_admin = true` — un flag sul dominio. Determina:

- Un **tenant-switcher** nell'interfaccia: il master admin sceglie un tenant e poi opera _dentro_
  quel tenant come un `admin`. L'impersonificazione è esplicita e loggata (un record di audit che
  dice "mastro X ha operato sul tenant Y").
- Privilegi di piattaforma: creare tenant, sospenderli, azzerare password, assegnare/revocare
  `master_admin`. Solo un master admin può crearne un altro.

Non è un quarto ruolo di membership: è un attributo globale che _mette a disposizione_ i poteri di
`admin` su qualsiasi tenant, più i poteri di piattaforma. La membership di un master admin non è
diversa da quella di chiunque altro quando è dentro un tenant — è l'accesso a _tutti_ i tenant che lo
distingue.

### 1.4 Autenticazione e tenant attivo

L'identità viaggia in un **JWT** firmato HS256: payload `sub` (user id), `iat`, `exp` (scadenza
breve, ~30 min). La firma usa un `JWT_SECRET` che vive solo in `.env` (§1.5). Il token è trasportato
in un cookie `httpOnly` + `Secure` + `SameSite=Lax` - mai in `localStorage`, dove uno script XSS lo
leggerebbe.

**Il tenant non sta dentro il token.** Scriverlo lì e "verificarlo" non chiude il varco: un utente
con più membership otterrebbe comunque un token valido, e nulla impedirebbe al server di fidarsi di
un `tenant_id` scelto dal client. La regola d'oro è che l'autorizzazione si risolve _sul server, a
ogni richiesta_: il JWT dice _chi sei_, non _cosa puoi vedere_. Il client dichiara il tenant attivo
(header `X-Tenant-Id` o route `/t/:slug`); il server carica le membership dell'utente e risponde 403
se non è membro di quel tenant. Un `master_admin` in impersonificazione passa dallo stesso controllo,
con in più il flag globale.

Il JWT è preferito alla sessione opaca per la statelessness tra istanze; l'alternativa equivalente è
un token opaco conservato in uno store di sessione condiviso. La revoca immediata resta stateless:
il JWT porta il `token_version` dell'utente, e un cambio/reset password o un logout lo incrementa,
invalidando all'istante ogni token precedente. La configurazione (§1.5) è il mezzo con cui il segreto
di firma non entra mai nel codice né nel repository.

### 1.5 Configurazione e segreti

Variabili d'ambiente e segreti vivono in un `.env` **gitignorato**; il repository traccia solo
`.env.example`, con valori placeholder. Nessun segreto reale entra nel tree, e l'agente non legge né
modifica mai il `.env` reale (vincolo esplicito in AGENTS.md). Le variabili previste: `DATABASE_URL`,
`JWT_SECRET`, `JWT_TTL`, `PORT`, `NODE_ENV`.

## 2. Isolamento dei dati

### 2.1 Il `tenant_id` sulle tabelle operative

La separazione logica richiede la stessa colonna su ogni tabella che porta dati di un tenant. Il
modello attuale ha tre app, quattro domini dati:

| Dominio | Tabelle attuali                                                            | Dove nasce `tenant_id`                                                                                                     |
| ------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| CRM     | `organizations`, `contacts`, `deals`, `activities`                         | su tutte; FK logica → `tenants`                                                                                            |
| Space   | `pages`, `blocks`, `properties`, `property_options`, `row_values`, `views` | su `pages` (radice); le figlie ereditano per FK, ma conviene ridondarla sulle foglie più lette (`blocks`) per evitare join |
| Rolodex | people, log, reminders, connections, timeline (per modulo)                 | sulla radice di ogni modulo; le foglie ereditano                                                                           |
| Auth    | `users`, `tenants`, `memberships`, `sessions`                              | _nessuna_: dominio globale                                                                                                 |

Regola: **ogni tabella operativa ha `tenant_id`**, anche dove si potrebbe ereditare via FK. Costa
qualche byte e paga in sicurezza: la query di scoping è sempre un banalissimo `WHERE tenant_id = ?`,
mai un join che qualcuno dimenticherà.

### 2.2 Row-Level Security come rete di sicurezza

RLS non sostituisce lo scoping a livello applicativo: lo _difende_. Se un bug nel codice produce una
query senza `tenant_id`, la policy deve farla ritornare zero righe, non tutti i tenant.

```
tenant_id è settato per sessione/transazione con
  SET LOCAL app.tenant_id = '<uuid>'
e ogni tabella operativa ha una policy:
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
```

Il pattern di accesso consigliato è una transazione per richiesta: si apre con l'`app.tenant_id`
settato, si eseguono le query, si chiude. Questo rende lo scoping _impossibile da dimenticare_, e
il fallimento visibile (eccezione o zero righe) anziché un data leak.

Eccezione deliberata: il dominio globale (`users`, `tenants`, `memberships`, `sessions`) non è
coperto da RLS per-tenant — è gestito da ruoli di connessione e dal codice, visto che master admin
e la gestione piattaforma operano _sopra_ il tenancy.

## 3. Modello dati applicativo: cosa cambia verso Postgres

Il porting non è uno "swap di driver": `better-sqlite3` è sincrono e specifico; `pg` è asincrono.
Di seguito le trasformazioni materiali.

### 3.1 Conversioni di SQL idiosincratico

| Costrutto oggi                          | Diventa in Postgres                                    | Note                                                                                          |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `INTEGER PRIMARY KEY AUTOINCREMENT`     | `id BIGINT GENERATED ALWAYS AS IDENTITY`               | `lastInsertRowid` → `RETURNING id`                                                            |
| `datetime('now')`                       | `now()` (timestamptz)                                  | le date opache diventano `timestamptz`; i giorni-calendario (`close_date`, `due_date`) `date` |
| `INTEGER 0/1` booleano                  | `boolean`                                              | il mappa-conversione `doneFlag` scompare                                                      |
| `PRAGMA table_info(...)` in `migrate()` | migratore dedicato (§3.2)                              | niente `ALTER ... in-place` ad hoc                                                            |
| `PRAGMA journal_mode = WAL`             | non applicabile                                        | la durabilità è del server, non del processo                                                  |
| `PRAGMA foreign_keys = ON`              | default in Postgres                                    |                                                                                               |
| `LIKE '%q%'`                            | invariato, oppure `ILIKE` per ricerca case-insensitive | solo se lo vuoi nel porting                                                                   |

### 3.2 Migrazioni

Il migratore scelto è un **runner SQL-first custom** (`server/src/db/migrate.ts`), non
`node-pg-migrate` né `drizzle-kit`: il data layer è già tutto SQL grezzo, e un file `.sql` numerato
applicato in ordine sotto un `pg_advisory_lock` è più piccolo e più trasparente di una CLI con un
proprio DSL. Punti fermi:

- File di migrazione numerati e versionati, applicati in ordine, con una tabella
  `schema_migrations` che traccia ciò che è stato eseguito.
- **Niente** migrazioni "in-place ad hoc" come l'attuale `migrate()` in `crm/db.ts`.
- Le migrazioni _devono_ includere `tenant_id NOT NULL` fin dalla creazione di ogni tabella
  operativa (nessuna tabella nasce senza e poi "viene aggiunta" la colonna).

### 3.3 Accesso asincrono

Tutte le funzioni del data layer (`createOrganization`, `listDeals`, `openDb`, le funzioni di
`auth/db.ts`) diventano `async` e ritornano `Promise`. Le `routes.ts` dei tre app, i seed, e in
parte la cerniera di `app.ts` diventano async. È un cambiamento meccanico ma esteso: ogni `.get()` /
`.all()` sincrono diventa `await client.query(...)`.

## 4. Piano d'azione (incrementi)

Ordine studiato per evitare il "doppio refactoring" (porting neutro _e poi_ threading del
tenant_id).

1. **Fondamenta verdi**: migratori e tooling di test Postgres (testcontainers), sostituire
   `:memory:` SQLite nei test server con un Postgres di test. Questo è il traguardo di "si può
   lavorare" prima di toccare il dominio.
2. **Dominio globale**: tabelle `users`, `tenants`, `memberships`, `sessions`; porting del layer
   auth (scrypt resta, §4.3); riscrittura del middleware di gate (`app.ts`) per membership + tenant
   attivo + RLS app.tenant_id.
3. **Dominio operativo, app per app**: portare CRM, poi Space, poi Rolodex, ognuno con il proprio
   `tenant_id` dalla prima query, seed multi-tenant, e un check end-to-end che due tenant non si
   vedono.
4. **Gli invarianti che cambiano**: "ultimo owner" sostituisce "ultimo admin"; il tenant-switcher
   del master admin; sospensione tenant.
5. **Containerizzazione allineata** (§4.4) in parallelo al punto 1, o subito dopo, visto che non
   dipende dal modello dati.

### 4.1 Cosa rimane identico

- **scrypt** per l'hashing password: già senza dipendenze, corretto, lento quanto serve. Da non
  toccare nel porting. Miglioramento opzionale, non necessario ora: un costo derivato dal flag
  `plan`, per i tenant "gold".
- **Le date delle app**: `close_date`/`due_date` sono giorni di calendario, non istanti — vanno
  tenuti come tali (colonna `date`), non appiattiti in timestamp.
- **La struttura per app**: CRM resta un modulo, Space un altro, Rolodex il "repo composito".
  Il porting non rimuove la separazione concettuale, solo il dialetto SQL e il driver.

### 4.2 Test

- Suite server: da `:memory:` SQLite a **testcontainers** (un Postgres per run, `tenant_id`
  isolato per test). I test che oggi sfruttano "un DB non seedato non gatea" vanno riscritti sul
  nuovo modello di membership.
- e2e Playwright: resta, ma ogni spec firma in _un tenant specifico_, non un utente globale.
- Serve un nuovo livello: **test di isolamento** che verifichi esplicitamente che il tenant A non
  legge righe del tenant B (con RLS attivo _e_ disattivo, per provare entrambe le difese).

### 4.3 Note di sicurezza

- Le sessioni sono JWT HS256 firmati con un segreto `.env`, scadenza breve (~30 min) e revoca
  immediata via `token_version` sull'utente: un cambio o reset password, o un logout, incrementa la
  colonna e invalida all'istante ogni token precedente.
- `must_change_password` resta, ma ora appartiene al dominio globale `users`, non a un singolo
  file.
- Logging dell'impersonificazione del master admin: ogni ingresso come admin in un tenant va
  registrato come evento di audit, non affidato alla memoria.

### 4.4 Containerizzazione (raccordo con la decisione precedente)

Il container è ortogonale al modello dati, ma va coerente con esso:

- **Un container applicativo** (Node/Express che serve anche `web/dist`) + **un container Postgres**
  gestito con volume persistente. Non il pattern "tutto in un container" che aveva senso nel
  modello local-first.
- Healthcheck su entrambi; `pg` dietro pool (`pgbouncer` in produzione se il numero di connessioni
  cresce, non al primo giro).
- Migrazioni eseguite al boot (o come job separato, non come effetto collaterale del primo avvio).

## 5. Cose esplicitamente rimandate

- **Permessi per-app**: al primo giro un ruolo di membership vale per tutte e tre le app. Se emerge
  il bisogno, si aggiunge una matrice `tenant_id + user_id + app + diritto` in seguito, senza
  rompere il modello.
- **Billing/plan**: `tenants.plan` è un segnaposto, non un sistema di feature-flag o quota.
- **Bulk import/export cross-tenant**: fuori scope del primo porting.
- **Backup/point-in-time recovery**: da definire quando c'è un'istanza condivisa reale, non in fase
  di design.

## 6. Rischio principale e come si mitiga

Il rischio più grande del SaaS multitenant è il **data leak tra tenant**, non la velocità di
query. Le tre difese, in ordine di importanza:

1. `tenant_id` sulla tabella, sempre, fin dalla creazione (non aggiunto dopo).
2. Scoping in ogni funzione del data layer (disciplina di codice).
3. RLS come valvola di sicurezza che azzera il danno di un bug.

La 3 non deve mai diventare la _prima_ linea — se lo diventa, è un fallimento della 1 e della 2 che
va corretto, non ignorato.
