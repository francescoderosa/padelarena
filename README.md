# 🎾 Controvetro PWA

PWA moderna per gestire partite di padel, serate a torneo e classifica ELO condivisa tra più dispositivi.

## ✨ Features

- 🏆 **Classifica ELO Globale** – Ranking dinamico basato sui risultati delle partite (pesi su compagno e avversari)
- ⚽ **Partite Flessibili** – Punteggio a **Set** o a **Games**, con gestione di **partite simultanee in corso**
- 🎯 **Modalità Serate / Tornei** – Calendario round-robin a 6 partite (es. 3 coppie × 2 gironi o 4 coppie), classifica interna della serata e aggiornamento automatico dell'ELO generale
- ☁️ **Sincronizzazione Multi-dispositivo (Cloudflare D1)** – Condivisione automatica in cloud tramite Pages Function, senza chiavi nel client
- 👥 **Gestione Giocatori** – Aggiungi, modifica ed elimina giocatori con avatar emoji
- 💾 **Offline-first & Installabile** – Funziona anche senza connessione grazie a localStorage e Service Worker PWA

---

## ⚡ Calcolo ELO delle serate torneo

Per ogni matchup completato, l'app calcola la variazione ELO confrontando la forza media delle due coppie con il risultato ottenuto.

### 1. ELO medio delle coppie

L'ELO di ogni coppia è la media degli ELO dei due giocatori:

```text
ELO coppia A = (ELO giocatore A1 + ELO giocatore A2) / 2
ELO coppia B = (ELO giocatore B1 + ELO giocatore B2) / 2
```

### 2. Risultato atteso

La probabilità attesa viene calcolata con la formula ELO standard, usando una scala di 400 punti:

```text
attesa A = 1 / (1 + 10 ^ ((ELO B - ELO A) / 400))
attesa B = 1 - attesa A
```

Per esempio, con una coppia A a 1040 ELO e una coppia B a 960 ELO, l'aspettativa è circa 61% per A e 39% per B.

### 3. Risultato effettivo e margine

Il risultato effettivo usa il punteggio del matchup. Con un risultato 6-3:

```text
risultato A = 6 / (6 + 3) = 66,7%
risultato B = 3 / (6 + 3) = 33,3%
```

Viene inoltre applicato un piccolo bonus proporzionale al margine:

```text
margine = |punti A - punti B| / totale × 0,15
```

Per 6-3 il margine è `3 / 9 × 0,15 = 0,05`. Il bonus viene applicato alla squadra vincente e sottratto alla perdente.

### 4. Variazione finale

Il fattore K è `32`:

```text
delta A = 32 × (risultato effettivo A - attesa A + bonus margine)
delta B = 32 × (risultato effettivo B - attesa B - bonus margine)
```

Il valore viene arrotondato all'intero più vicino. Ogni giocatore della stessa coppia riceve lo stesso delta ELO; il delta mostrato nella classifica della serata è quindi la variazione del singolo giocatore, non la somma dei due componenti della coppia.

### Ricostruzione degli ELO

Per calcolare il dettaglio ELO di una serata, l'app parte da `1000` per ogni giocatore e rigioca in ordine cronologico tutte le partite completate. In questo modo le stime pre-partita tengono conto dei risultati precedenti e non dipendono soltanto dall'ordine con cui si apre la schermata.

Il dettaglio della serata mostra per ogni matchup:

- ELO medi pre-partita delle due coppie;
- percentuale attesa per ciascuna coppia;
- risultato effettivo derivato dal punteggio;
- bonus del margine;
- variazione ELO finale.

---

## 🖼️ Rimozione dello sfondo dalle immagini

Per rimuovere lo sfondo con `rembg` ed esportare un PNG trasparente:

```bash
rembg i "/percorso/immagine_input.png" "/percorso/immagine_transparent.png"
```

Esempio:

```bash
rembg i "/Users/francesco.derosa/Downloads/brawlers/lele_full.png" "/Users/francesco.derosa/Downloads/brawlers/lele_full_transparent.png"
```

Il file di destinazione viene creato in formato PNG RGBA con il canale alpha per la trasparenza.

Per preparare e uniformare le immagini full-body dei giocatori, consulta la
[guida agli asset dei giocatori](assets/players/README.md).

### Generazione degli asset Brawl

Il generatore legge le immagini `*_brawl.png`/`*_brawl.jpeg` da
`~/Downloads/brawlers` e produce automaticamente i tre asset associati agli ID
dei giocatori in `assets/players`:

```bash
python3 -m pip install Pillow rembg
python3 scripts/generate_brawl_assets.py
```

Il comando genera i file `_closeup.png`, `_full.png` e `_complete.png`.
`_full` è un PNG trasparente verticale `704x1024`, mentre `_complete` conserva
la scena originale e `_closeup` produce un ritratto quadrato ravvicinato.
Il primo avvio di `rembg` può scaricare il modello di rimozione dello sfondo.

---

## ☁️ Sincronizzazione Multi-dispositivo

La sincronizzazione condivisa usa **Cloudflare D1** tramite una **Cloudflare Pages Function** (`/api/sync`). Il frontend non contiene credenziali e la modale Cloud Sync gestisce solo la preferenza di auto-sync.

### Come funziona oggi

1. L'app salva sempre i dati correnti in `localStorage`, così resta utilizzabile anche offline.
2. Quando l'auto-sync è attivo, ogni modifica programma un invio al cloud dopo un breve ritardo, evitando richieste ripetute durante la stessa operazione.
3. All'avvio e ogni 25 secondi, quando la pagina è visibile, l'app chiede gli ultimi dati a `/api/sync`.
4. Il pulsante `🔄 Sync` esegue una lettura manuale; `Scarica dal Cloud` forza la sostituzione dei dati locali con quelli cloud, mentre `Invia al Cloud` pubblica lo stato locale.
5. La Function riceve le richieste dal browser e legge/scrive lo stato in D1. La risposta non viene memorizzata dal Service Worker.

Il browser conosce soltanto l'endpoint relativo `/api/sync`: non vede credenziali D1. Disattivare l'auto-sync interrompe gli invii e il polling automatici, ma non disabilita le azioni manuali.

### Configurazione Cloudflare
Nel progetto Cloudflare Pages vai su **Settings → Environment variables** e configura nell'ambiente corretto:
- `CLUB_STATE_ID`: identificativo tecnico dello stato persistito in D1. Usa valori diversi per dev e produzione.

Il progetto production e il progetto dev (`controvetro.dev.padelmate.it`) devono usare `CLUB_STATE_ID` distinti. Se la variabile non è configurata, la Function usa l'hostname della richiesta come identificativo, evitando collisioni tra ambienti ma rendendo l'hostname parte del dato tecnico.

Dopo aver configurato il binding D1 e la variabile, esegui un nuovo deploy. Se il binding manca, l'endpoint restituisce un errore di configurazione e l'app resta disponibile con i dati locali.

---

## 🚀 Deploy su Cloudflare Pages

1. Collega il repository GitHub al progetto Cloudflare Pages.
2. Imposta il branch di produzione su `master` e la directory di output su `/`.
3. Non serve un comando di build: il progetto è una PWA statica e la cartella `functions/` viene rilevata automaticamente da Cloudflare Pages.
4. Configura il binding D1 `PUSH_DB` e `CLUB_STATE_ID` nel dashboard Cloudflare.
5. Esegui un nuovo deploy e verifica l'app dal dominio Pages o dal dominio personalizzato.

La Function viene pubblicata insieme al sito: `functions/api/sync.js` diventa l'endpoint `/api/sync`. Non è necessario creare o gestire un Worker separato.

### Import iniziale da JSONBin

Lo script `scripts/import-jsonbin-to-d1.mjs` esegue un import una tantum del bin JSONBin verso l'endpoint D1. Di default esegue solo un dry-run; la scrittura richiede esplicitamente `--apply`.

Esempio per dev:

```bash
JSONBIN_BIN_ID='bin-dev' \\
JSONBIN_API_KEY='la-chiave-jsonbin' \\
npm run import:jsonbin -- \\
  --target https://controvetro.dev.padelmate.it/api/sync
```

Dopo aver verificato i conteggi del dry-run, ripetere il comando con `--apply`. Eseguire separatamente l'import production usando il bin production e il target `https://controvetro.padelmate.it/api/sync`. Lo script rifiuta per default uno stato completamente vuoto per evitare sovrascritture accidentali.

Se Node locale segnala un errore TLS come `unable to get local issuer certificate`, esportare prima il bin con `curl` e usare `--source-file`:

```bash
curl --fail --silent --show-error \\
  -H "X-Access-Key: $JSONBIN_API_KEY" \\
  "https://api.jsonbin.io/v3/b/$JSONBIN_BIN_ID/latest" \\
  -o /tmp/controvetro-jsonbin-dev.json

npm run import:jsonbin -- \\
  --source-file /tmp/controvetro-jsonbin-dev.json \\
  --target http://localhost:8789/api/sync
```

### Configurazione Web Push e D1

Le notifiche push e lo stato applicativo usano lo stesso database D1, in tabelle separate. Per creare e collegare il database:

```bash
npx wrangler d1 create controvetro-push
npx wrangler d1 migrations apply controvetro-push --remote
```

Prima di applicare la migrazione, collega il database al progetto Pages dal dashboard Cloudflare in **Settings → Bindings → D1 database bindings**, usando:

- variable name: `PUSH_DB`
- database: `controvetro-push`

Genera una coppia VAPID una sola volta e configura i secret nell'ambiente Pages corretto:

```bash
node --input-type=module -e "import { generateVapidKeys } from '@mmmike/web-push/vapid'; console.log(await generateVapidKeys())"
npx wrangler pages secret put VAPID_PUBLIC_KEY
npx wrangler pages secret put VAPID_PRIVATE_KEY
npx wrangler pages secret put VAPID_SUBJECT
npx wrangler pages secret put PUSH_ADMIN_SECRET
```

`VAPID_PRIVATE_KEY` e `PUSH_ADMIN_SECRET` non devono mai essere pubblicati. `VAPID_PUBLIC_KEY` viene restituita dal solo endpoint server `/api/push/public-key` e usata dal browser per creare la subscription. L'endpoint amministrativo `/api/push/send` richiede l'header `X-Admin-Secret` e non viene chiamato dalla PWA.

Le migrazioni SQL si trovano in `migrations/`. Oltre a `0001_push_subscriptions.sql`, `0002_club_state.sql` crea la tabella dello stato applicativo. In locale si può usare un database D1 locale con `wrangler pages dev .`; se il binding non è disponibile, l'app resta utilizzabile e la sincronizzazione segnala la configurazione mancante.

## LOGS

Le Pages Functions vengono eseguite sul deployment Cloudflare Pages e i loro log si possono consultare con Wrangler oppure dalla dashboard Cloudflare. I log riguardano le richieste server-side alle Function; un errore che avviene nel browser prima della `fetch` non apparirà qui e va controllato nella Console del browser.

### Tail in tempo reale con Wrangler

Per osservare le richieste del progetto dev, apri un terminale nella root del repository ed esegui:

```bash
npx wrangler pages deployment tail \
  --project-name padelarena-dev \
  --environment production \
  --format pretty
```

Lascia il comando attivo, esegui l'operazione nell'app e interrompi il tail con `Ctrl+C`. Per il progetto production sostituisci `padelarena-dev` con `padelarena`. `--environment production` indica l'ambiente Pages del progetto, non il dominio applicativo: il progetto `padelarena-dev` pubblica comunque il dominio dev `controvetro.dev.padelmate.it`.

Per filtrare gli errori del deployment:

```bash
npx wrangler pages deployment tail \
  --project-name padelarena-dev \
  --environment production \
  --status error \
  --format pretty
```

In alternativa, dalla dashboard: **Workers & Pages → padelarena-dev → deployment attivo → View details → Functions / Real-time logs**. La lista dei deployment è consultabile con:

```bash
npx wrangler pages deployment list --project-name padelarena-dev
```

### Costruire le `curl`

Le API sono relative al dominio dell'ambiente. È preferibile definire prima la base URL:

```bash
export BASE_URL="https://controvetro.dev.padelmate.it"
```

La chiave pubblica VAPID è leggibile senza autenticazione:

```bash
curl -i "$BASE_URL/api/push/public-key"
```

Il preflight CORS si verifica con `OPTIONS`:

```bash
curl -i -X OPTIONS "$BASE_URL/api/push/subscribe" \
  -H "Origin: $BASE_URL" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

Per testare la validazione dell'endpoint subscription si può inviare un payload incompleto. Questo deve restituire `400` e conferma che la Function è raggiungibile:

```bash
curl -i -X POST "$BASE_URL/api/push/subscribe" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Una subscription reale non va inventata: viene generata dal browser e contiene `endpoint`, `keys.p256dh` e `keys.auth`. Il client la invia automaticamente a `/api/push/subscribe` insieme all'`installId`. Per inviare una notifica di test è invece necessario usare l'endpoint amministrativo e il secret corretto dell'ambiente:

#### Test invio notifica

Sul terminale usa il secret configurato per `padelarena-dev` e il dominio dev:

```bash
export PUSH_ADMIN_SECRET="<PUSH_ADMIN_SECRET dell'ambiente>"

curl -i -X POST "$BASE_URL/api/push/send" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $PUSH_ADMIN_SECRET" \
  -d '{
    "title": "Test Controvetro",
    "body": "Notifica push di prova",
    "url": "/"
  }'
```

Una risposta `200` conferma l'elaborazione del batch e include contatori simili a `total`, `delivered`, `removed` e `failed`. Con una subscription attiva, `delivered` dovrebbe essere almeno `1` e la notifica dovrebbe comparire sul dispositivo entro pochi secondi. Per production imposta invece:

```bash
export BASE_URL="https://controvetro.padelmate.it"
```

Non inserire `VAPID_PRIVATE_KEY` o `PUSH_ADMIN_SECRET` nel repository, nei comandi condivisi o nel codice client. Se il tail non mostra alcuna richiesta quando si clicca un pulsante, controllare prima la Console del browser: il problema può trovarsi in `Notification.requestPermission()`, nel Service Worker o in `PushManager.subscribe()` e quindi precedere la chiamata HTTP.

### Modificabilita delle partite

Ogni battaglia (`matches`) e ogni serata (`tournaments`) ha il campo `editable`, che vale `true` per i dati esistenti quando il campo non è presente. La partita resta comunque modificabile solo entro 7 giorni dalla data: `editable: false` consente di chiuderla in anticipo, ma non può riaprirla dopo la scadenza automatica.

Le rotte amministrative sono raggruppate sotto `/api/admin/` e usano lo stesso header `X-Admin-Secret` della rotta push:

```bash
export PUSH_ADMIN_SECRET="<PUSH_ADMIN_SECRET dell'ambiente>"

curl -i -X PATCH "$BASE_URL/api/admin/matches/<MATCH_ID>/editable" \
  -H "X-Admin-Secret: $PUSH_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"editable":false}'

curl -i -X PATCH "$BASE_URL/api/admin/tournaments/<TOURNAMENT_ID>/editable" \
  -H "X-Admin-Secret: $PUSH_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"editable":true}'
```

Il server rifiuta con `409` le sincronizzazioni che tentano di modificare o rimuovere una partita o una serata chiusa manualmente o scaduta.

## PUSH NOTIFICATIONS

### Modello Web Push

Web Push è un protocollo per consegnare un messaggio a un browser anche quando la pagina web non è aperta. Il modello separa il sito applicativo dal **push service** del browser, ad esempio quello gestito da Google, Mozilla o Apple. Il sito non apre una connessione persistente verso ogni dispositivo: registra una subscription e usa il relativo endpoint per chiedere al push service di consegnare il messaggio.

Una subscription contiene principalmente:

- `endpoint`: URL univoco del push service per quel browser e quel dispositivo;
- `p256dh`: chiave pubblica effimera del client;
- `auth`: segreto usato nel materiale crittografico della subscription.

Il browser crea questi valori solo dopo una richiesta esplicita dell'utente. Il server usa le chiavi VAPID per autenticare il mittente e cifra il payload secondo il protocollo Web Push. Il push service inoltra il contenuto cifrato senza dover conoscere il significato applicativo del messaggio. Il Service Worker del sito riceve l'evento `push`, mostra la notifica con `showNotification()` e gestisce l'apertura o il focus della PWA tramite `notificationclick`.

Il consenso alle notifiche e la subscription sono concetti distinti: il permesso autorizza il browser a mostrare notifiche, mentre la subscription identifica la destinazione tecnica a cui il server può inviare i messaggi. Una subscription può diventare invalida, per esempio dopo la revoca del permesso o la sostituzione del dispositivo, quindi gli endpoint che rispondono `404` o `410` devono essere rimossi.

### Integrazione con Cloudflare

In questo progetto Cloudflare Pages ospita sia gli asset statici della PWA sia le Pages Functions sotto `functions/api/`. Il binding D1 `PUSH_DB` collega le Function al database SQLite serverless `controvetro-push` senza esporre credenziali al browser.

Il flusso server-side è il seguente:

1. `GET /api/push/public-key` restituisce solo `VAPID_PUBLIC_KEY`.
2. Il browser usa la chiave pubblica per chiamare `PushManager.subscribe()`.
3. `POST /api/push/subscribe` valida e salva la subscription nella tabella D1 `push_subscriptions`.
4. Un operatore o un servizio autorizzato chiama `POST /api/push/send` con `X-Admin-Secret`.
5. La Function legge da D1 le subscription abilitate e usa `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` per inviare il batch tramite `@mmmike/web-push`.
6. Gli endpoint non più validi vengono rimossi da D1; il risultato riporta consegnate, rimosse e fallite.

Cloudflare gestisce l'esecuzione edge delle Function, il binding verso D1 e la protezione dei secret configurati nell'ambiente Pages. D1 contiene le destinazioni push e lo stato applicativo condiviso in tabelle separate.

### Implementazione nel progetto

Il client mantiene un identificativo anonimo persistente (`installId`) in `localStorage`, non un account. Quando l'utente apre la modale delle impostazioni, l'interfaccia verifica il supporto a `Notification`, `serviceWorker` e `PushManager`. Il permesso viene richiesto esclusivamente dopo il click su **ATTIVA NOTIFICHE**. Dopo la creazione della subscription, `app.js` serializza le chiavi binarie in Base64URL e invia il payload alla Pages Function.

I file principali sono:

- `app.js`: gestione del permesso, registrazione Service Worker, creazione/disattivazione subscription e aggiornamento dello stato nella modale impostazioni;
- `sw.js`: ricezione dell'evento `push`, fallback del payload, visualizzazione della notifica e gestione del click;
- `functions/api/push/public-key.js`: pubblicazione della chiave VAPID pubblica;
- `functions/api/push/subscribe.js`: validazione, upsert e cancellazione delle subscription D1;
- `functions/api/push/send.js`: invio amministrativo autenticato, batch e rimozione degli endpoint scaduti;
- `functions/api/push/_shared.js`: risposte JSON, CORS e validazioni comuni;
- `migrations/0001_push_subscriptions.sql`: schema della tabella D1.

La funzionalità attuale è volutamente generica: consente di iscrivere un dispositivo e inviare comunicazioni del club. Account, ownership del player, membership e notifiche personalizzate basate su eventi di dominio appartengono a iterazioni successive e non sono necessari per il primo canale push.

### Avvio locale con Wrangler

Wrangler è già installato nel progetto. Per avviare anche la Function `/api/sync`:

1. Copia `.env.example` in `.env`.
2. Inserisci in `.env` un `CLUB_STATE_ID` coerente con l'ambiente locale.
3. Avvia il server con `wrangler pages dev .`.
4. Apri `http://localhost:8788`.

Il file `.env` è escluso da Git e non deve essere pubblicato o condiviso. Wrangler carica automaticamente questo file durante `pages dev`.

---

## 🧹 Cache e aggiornamento PWA

Il Service Worker (`sw.js`) usa una cache versionata (`CACHE_NAME`), ma per HTML, CSS e JavaScript applica una strategia **network-first**: il browser prova prima a scaricare la versione pubblicata e usa la cache solo come fallback offline. Le richieste a `sw.js` vengono escluse dalla cache, così il worker può aggiornarsi correttamente.

La registrazione usa `updateViaCache: 'none'`:

```js
  navigator.serviceWorker.register('sw.js?v=4.14', { updateViaCache: 'none' });
```

Il parametro `?v=4.11` è un ulteriore cache busting, ma non deve necessariamente essere incrementato a ogni modifica: il browser controlla comunque il contenuto aggiornato di `sw.js`. La modifica del file è sufficiente per rilevare una nuova versione del Service Worker. Incrementare anche `CACHE_NAME` resta utile per invalidare esplicitamente la cache precedente.

Se un browser ha già installato il vecchio worker cache-first e continua a mostrare file obsoleti, eseguire una sola volta dalla console del sito:

```js
navigator.serviceWorker.getRegistrations()
  .then(rs => Promise.all(rs.map(r => r.unregister())))
  .then(() => caches.keys())
  .then(keys => Promise.all(keys.map(k => caches.delete(k))))
  .then(() => location.reload());
```

---

## 🧮 Algoritmo ELO

- **Rating iniziale**: 1000 punti
- **K-factor**: 32
- La **media ELO della coppia** determina il rating di squadra
- Il delta tiene conto della probabilità attesa di vittoria (differenziale compagno/avversari) e del margine di set/games vinti
- Ricalcolo automatico deterministico per garantire consistenza assoluta
