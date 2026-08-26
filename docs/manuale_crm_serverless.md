# Manuale di Configurazione: CRM Serverless su Google Cloud Run protetto da Cloudflare Zero Trust

Questo manuale guida passo-passo nella configurazione di un'architettura **Serverless a costo zero** per un CRM aziendale a basso traffico (2-3 utenti). La soluzione utilizza **Google Cloud Run** per l'hosting del container (scalato a zero quando non usato) e **Cloudflare Zero Trust** come "buttafuori digitale" per l'autenticazione sicura senza la complessità di una VPN classica.

Inoltre, il manuale include la configurazione di un **volume persistente** tramite **Google Cloud Storage (FUSE)** per ospitare in sicurezza il database **SQLite**, evitando la perdita di dati allo spegnimento del container e prevenendo la corruzione del file.

---

## 📋 Prerequisiti

1. Un **dominio web** di proprietà (es. `azienda.it`) configurato e gestito su Cloudflare (piano gratuito).
2. Un account **Google Cloud Platform (GCP)** con la fatturazione attivata (indispensabile per Cloud Run, anche se rimarrai nella soglia gratuita).
3. Il codice del CRM pronto con un file `Dockerfile`.

---

## 🛠️ PASSO 1: Configurare Cloudflare Zero Trust

Questo passaggio crea la barriera protettiva che richiede un'autenticazione agli utenti prima ancora che la richiesta raggiunga Google Cloud.

1. Accedi alla dashboard di **Cloudflare** e nel menu a sinistra seleziona **Zero Trust**.
2. Scegli il piano **Free** (gratuito fino a 50 utenti).
3. Nel pannello Zero Trust, naviga su **Access** > **Applications** e clicca su **Add an application**.
4. Seleziona l'opzione **Self-hosted**.
5. Configura i dettagli dell'applicazione:
   - **Application name:** `CRM Aziendale`
   - **Session Duration:** `24 Hours` (o la durata desiderata prima di richiedere un nuovo login).
   - **Application URL:** Scegli il sottodominio desiderato (es. `crm`) e seleziona il tuo dominio (`azienda.it`).
6. Clicca su **Next** per andare alla scheda **Policies** (Regole di accesso):
   - **Policy name:** `Accesso Personale Autorizzato`
   - **Action:** `Allow`
   - Nella sezione **Configure rules** (sotto _Include_): Seleziona **Selector** = `Emails` e nel campo _Value_ inserisci gli indirizzi email dei tuoi utenti autorizzati (es. `mario@example.com`, `luigi@example.com`).
7. Clicca su **Next** e completa cliccando su **Add application**.

_Da questo momento, chiunque tenti di accedere a `crm.azienda.it` dovrà inserire la propria email e un codice OTP temporaneo ricevuto sulla stessa prima di visualizzare qualsiasi contenuto._

---

## 🛠️ PASSO 2: Creare il Volume Persistente per SQLite su Google Cloud

Dato che Cloud Run è stateless e distrugge il container quando non c'è traffico, dobbiamo mappare un secchiello di archiviazione fissa (**Cloud Storage Bucket**) che ospiterà il file `crm.db`.

1. Apri la console di Google Cloud (GCP) e seleziona o crea un progetto (es. `crm-aziendale-project`). Nota il tuo **ID Progetto**.
2. Apri **Cloud Shell** (cliccando sull'icona del terminale in alto a destra nella barra superiore di GCP).
3. Crea un bucket di archiviazione nella stessa regione in cui eseguirai il container (es. `europe-west1` per il Belgio):
   ```bash
   gcloud storage buckets create gs://IL_TUO_ID_PROGETTO-crm-storage --location=europe-west1
   ```
4. _(Consigliato)_ Attiva il versionamento del bucket per avere backup automatici e storici del database SQLite in caso di errori:
   ```bash
   gcloud storage buckets update gs://IL_TUO_ID_PROGETTO-crm-storage --versioning
   ```

---

## 🛠️ PASSO 3: Preparare il Dockerfile e Caricare il Container

Per consentire a SQLite di scrivere correttamente sul volume Cloud Storage, il tuo CRM deve salvare il database in una cartella specifica (es. `/app/data`). Assicurati che nel codice del tuo CRM la stringa di connessione punti a `/app/data/crm.db`.

### Esempio di Dockerfile ottimizzato:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Copia i file dei requisiti e installa le dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia il codice del CRM
COPY . .

# Crea la cartella dedicata al database SQLite
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["python", "main.py"]
```

### Comandi per compilare e caricare l'immagine:

1. All'interno di Cloud Shell (o dal tuo terminale con `gcloud CLI` configurato), abilita le API necessarie:
   ```bash
   gcloud services enable artifactregistry.googleapis.com run.googleapis.com
   ```
2. Crea il registro per i tuoi container:
   ```bash
   gcloud artifacts repositories create crm-repo        --repository-format=docker        --location=europe-west1        --description="Repository per container CRM"
   ```
3. Posizionati nella cartella del tuo progetto (dove risiede il `Dockerfile`) e compila l'immagine direttamente sul cloud:
   ```bash
   gcloud builds submit --tag europe-west1-docker.pkg.dev/IL_TUO_ID_PROGETTO/crm-repo/crm-app:v1
   ```

---

## 🛠️ PASSO 4: Rilasciare l'applicazione su Google Cloud Run

Configuriamo l'istanza con i parametri di scalabilità azzerati per il risparmio economico e colleghiamo il volume Cloud Storage.

1. Nella barra di ricerca della console GCP cerca **Cloud Run** e clicca su **Crea servizio**.
2. Scegli **Distribuisci una revisione da un'immagine del contenitore esistente** e seleziona l'immagine caricata al passo precedente (`crm-app:v1`).
3. Imposta i dettagli del servizio:
   - **Nome del servizio:** `crm-app`
   - **Regione:** `europe-west1`
4. Nella sezione **Autenticazione**, seleziona **Consenti chiamate non autenticate** (la sicurezza sarà gestita a monte da Cloudflare).
5. Espandi il menu a tendina **Contenitore, volumi, reti, sicurezza** in fondo alla pagina per configurare i dettagli critici:

   ### ⚠️ Configurazione di Scalabilità e Concorrenza (FONDAMENTALE PER SQLITE)
   - Nella scheda **Contenitore**, scorri fino a **Scalabilità**.
   - **Numero minimo di istanze:** Imposta a `0` _(permette lo spegnimento totale e il costo zero quando nessuno usa il CRM)_.
   - **Numero massimo di istanze:** Imposta tassativamente a `1` _(SQLite non supporta scritture concorrenti da più container separati; limitando il massimo a 1 istanza si evita la corruzione del database)_.

   ### 💾 Collegamento del Volume Persistente (Cloud Storage FUSE)
   - Vai alla scheda **Volumi** e clicca su **Aggiungi Volume**.
   - **Tipo di volume:** Seleziona `Cloud Storage bucket`.
   - **Nome del volume:** Inserisci un nome mnemonico (es. `crm-db-volume`).
   - **Bucket:** Seleziona il bucket creato al Passo 2 (`IL_TUO_ID_PROGETTO-crm-storage`).
   - Spostati nella scheda **Montaggi di volumi** del contenitore (subito sotto).
   - Clicca su **Monta volume**.
   - Seleziona il volume appena creato (`crm-db-volume`) e come **Percorso di montaggio** inserisci `/app/data`.

6. Clicca su **Crea**. Al completamento, Cloud Run ti fornirà un URL pubblico (es. `https://crm-app-xxxxxx.a.run.app`). Copia questo indirizzo.

---

## 🛠️ PASSO 5: Collegare Cloudflare e Blindare l'Infrastruttura

Infine, facciamo in modo che il dominio aziendale punti a Google Cloud Run passando obbligatoriamente per il controllo di Cloudflare.

1. Accedi alla dashboard principale di **Cloudflare** ed seleziona il tuo dominio (`azienda.it`).
2. Vai alla sezione **DNS** > **Records** e clicca su **Add record**:
   - **Type:** `CNAME`
   - **Name:** `crm` (creerà l'indirizzo `crm.azienda.it`).
   - **Target:** Incolla l'URL di Google Cloud Run fornito al termine del Passo 4 (avendo cura di rimuovere il prefisso `https://` e lo slash finale `/`, es: `crm-app-xxxxxx.a.run.app`).
   - **Proxy status:** Assicurati che la nuvoletta sia **Arancione** (`Proxied`).
3. Clicca su **Save**.

### 🔒 Blindatura Avanzata nel codice dell'Applicazione (Consigliata)

Per evitare che un utente malintenzionato possa scavalcare Cloudflare qualora scoprisse l'URL diretto nativo di Google Cloud Run (`*.a.run.app`), puoi aggiungere un controllo all'interno del codice del tuo CRM (es. nel middleware o nello script di autenticazione principale).

Quando una richiesta passa attraverso Cloudflare Zero Trust, Cloudflare inserisce un header HTTP speciale denominato `Cf-Access-Authenticated-User-Email`. Puoi configurare il tuo CRM affinché verifichi la presenza di questo header:

- Se l'header è **presente**, l'applicazione estrae l'email ed esegue il login dell'utente.
- Se l'header è **assente**, l'applicazione risponde con un errore `403 Forbidden`, bloccando l'accesso diretto.

---

## 🎯 Flusso d'Uso e Manutenzione

- **Primo Accesso:** Quando un utente apre `crm.azienda.it` dopo ore di inattività, Cloud Run avvierà il container da zero (**Cold Start**). Il caricamento iniziale potrebbe richiedere dai 5 ai 10 secondi. Le interazioni successive saranno istantanee.
- **Inattività:** Dopo circa 15 minuti di totale inattività da parte degli utenti, Google Cloud spegnerà automaticamente il container portando il consumo di CPU e RAM a zero.
- **Backup:** Grazie al versionamento attivato sul bucket, ogni modifica effettuata sul file `crm.db` genera uno storico consultabile e ripristinabile direttamente dalla console Cloud Storage di Google.
