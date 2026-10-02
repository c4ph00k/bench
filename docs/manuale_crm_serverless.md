# Deployment serverless — guida precedente ritirata

**Stato:** le istruzioni precedenti non si applicano all'architettura attuale.

Questa guida descriveva un CRM con SQLite su un volume Cloud Storage FUSE, un Dockerfile Python
e una sola istanza applicativa. Bench usa ora Node/Express e un database PostgreSQL condiviso,
con utenti, membership e isolamento multi-tenant. Quelle istruzioni sono state rimosse per
non usarle come procedura di deployment del progetto attuale; la versione precedente resta
consultabile nella cronologia Git.

## Riferimenti attuali

- [PROJECT.md](./PROJECT.md): struttura, architettura e comandi di avvio.
- [SAAS-MULTITENANCY.md](./SAAS-MULTITENANCY.md): PostgreSQL, tenant, migrazioni e RLS.
- [README.md](../README.md): installazione ed esecuzione locale o con Docker Compose.
- [Dockerfile](../Dockerfile) e [docker-compose.yml](../docker-compose.yml): immagine Node e
  deployment con un container PostgreSQL separato e volume persistente.

Il server richiede `DATABASE_URL` e `JWT_SECRET`, applica le migrazioni al boot e gestisce
l'autenticazione con login e sessioni JWT. Non usa un file database nel container applicativo
né un volume FUSE per i dati operativi.

## Deployment cloud da definire

Questo repository non contiene una procedura verificata per Cloud Run e Cloudflare Zero Trust.
La configurazione del database PostgreSQL esterno, della connettività, dei segreti, dei backup e
degli eventuali controlli di accesso aggiuntivi va definita per il deployment scelto. La vecchia
promessa di costo zero e il vincolo di una sola istanza appartenevano alla guida ritirata.
