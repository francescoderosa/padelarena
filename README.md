# 🎾 Controvetro PWA

PWA moderna per gestire partite di padel, serate a torneo e classifica ELO condivisa tra più dispositivi.

## ✨ Features

- 🏆 **Classifica ELO Globale** – Ranking dinamico basato sui risultati delle partite (pesi su compagno e avversari)
- ⚽ **Partite Flessibili** – Punteggio a **Set** o a **Games**, con gestione di **partite simultanee in corso**
- 🎯 **Modalità Serate / Tornei** – Calendario round-robin a 6 partite (es. 3 coppie × 2 gironi o 4 coppie), classifica interna della serata e aggiornamento automatico dell'ELO generale
- ☁️ **Sincronizzazione Multi-dispositivo (JSONBin.io)** – Condivisione automatica in cloud tramite proxy Cloudflare, senza chiavi nel client
- 👥 **Gestione Giocatori** – Aggiungi, modifica ed elimina giocatori con avatar emoji
- 💾 **Offline-first & Installabile** – Funziona anche senza connessione grazie a localStorage e Service Worker PWA

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

La sincronizzazione condivisa usa **JSONBin.io** tramite una **Cloudflare Pages Function** (`/api/sync`). Il frontend non contiene credenziali e la modale Cloud Sync gestisce solo la preferenza di auto-sync.

### Come funziona oggi

1. L'app salva sempre i dati correnti in `localStorage`, così resta utilizzabile anche offline.
2. Quando l'auto-sync è attivo, ogni modifica programma un invio al cloud dopo un breve ritardo, evitando richieste ripetute durante la stessa operazione.
3. All'avvio e ogni 25 secondi, quando la pagina è visibile, l'app chiede gli ultimi dati a `/api/sync`.
4. Il pulsante `🔄 Sync` esegue una lettura manuale; `Scarica dal Cloud` forza la sostituzione dei dati locali con quelli cloud, mentre `Invia al Cloud` pubblica lo stato locale.
5. La Function riceve le richieste dal browser, aggiunge server-side l'`X-Access-Key` e inoltra GET/PUT alle API JSONBin. La risposta non viene memorizzata dal Service Worker.

Il browser conosce soltanto l'endpoint relativo `/api/sync`: non vede né `JSONBIN_BIN_ID` né `JSONBIN_API_KEY`. Disattivare l'auto-sync interrompe gli invii e il polling automatici, ma non disabilita le azioni manuali.

### Configurazione Cloudflare
Nel progetto Cloudflare Pages vai su **Settings → Environment variables** e aggiungi come secret nell'ambiente corretto:
- `JSONBIN_BIN_ID`: ID del Bin JSONBin condiviso.
- `JSONBIN_API_KEY`: Access Key JSONBin.

Il progetto production usa il bin production; il progetto dev (`controvetro.dev.padelmate.it`) usa un bin e una chiave distinti. Il nome dell'ambiente mostrato nell'interfaccia viene determinato dal dominio, senza esporre i secret al browser.

Dopo aver salvato i secret, esegui un nuovo deploy. La Function server-side inoltra le richieste a JSONBin senza esporre la chiave al browser. Se i secret mancano, l'endpoint restituisce un errore di configurazione e l'app resta disponibile con i dati locali.

Il workflow GitHub `JSONBin Production Backup` esegue il backup del solo bin production usando i secret GitHub `JSONBIN_BIN_ID` e `JSONBIN_API_KEY`. Questi secret devono quindi puntare esclusivamente alla produzione.

Per sicurezza, revoca e sostituisci la vecchia Access Key, perché una versione storica del repository la conteneva. I secret di Cloudflare non devono essere inseriti in `app.js`, nel manifest, nel Service Worker o in qualsiasi file statico pubblicato.

---

## 🚀 Deploy su Cloudflare Pages

1. Collega il repository GitHub al progetto Cloudflare Pages.
2. Imposta il branch di produzione su `master` e la directory di output su `/`.
3. Non serve un comando di build: il progetto è una PWA statica e la cartella `functions/` viene rilevata automaticamente da Cloudflare Pages.
4. Configura i secret JSONBin descritti sopra nel dashboard Cloudflare.
5. Esegui un nuovo deploy e verifica l'app dal dominio Pages o dal dominio personalizzato.

La Function viene pubblicata insieme al sito: `functions/api/sync.js` diventa l'endpoint `/api/sync`. Non è necessario creare o gestire un Worker separato.

### Configurazione Web Push e D1

Le notifiche push usano D1 soltanto per le subscription dei dispositivi. I dati applicativi continuano a usare JSONBin. Per creare e collegare il database:

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

La migrazione SQL si trova in `migrations/0001_push_subscriptions.sql`. In locale si può usare un database D1 locale con `wrangler pages dev .`; se il binding non è disponibile, l'app resta utilizzabile e la sezione notifiche segnala la configurazione mancante.

### Avvio locale con Wrangler

Wrangler è già installato nel progetto. Per avviare anche la Function `/api/sync`:

1. Copia `.env.example` in `.env`.
2. Inserisci in `.env` gli stessi valori di `JSONBIN_BIN_ID` e `JSONBIN_API_KEY` configurati su Cloudflare.
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
