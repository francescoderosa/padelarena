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
Nel progetto Cloudflare Pages vai su **Settings → Environment variables** e aggiungi come secret nell'ambiente **Production**:
- `JSONBIN_BIN_ID`: ID del Bin JSONBin condiviso.
- `JSONBIN_API_KEY`: Access Key JSONBin.

Dopo aver salvato i secret, esegui un nuovo deploy. La Function server-side inoltra le richieste a JSONBin senza esporre la chiave al browser. Se i secret mancano, l'endpoint restituisce un errore di configurazione e l'app resta disponibile con i dati locali.

Per sicurezza, revoca e sostituisci la vecchia Access Key, perché una versione storica del repository la conteneva. I secret di Cloudflare non devono essere inseriti in `app.js`, nel manifest, nel Service Worker o in qualsiasi file statico pubblicato.

---

## 🚀 Deploy su Cloudflare Pages

1. Collega il repository GitHub al progetto Cloudflare Pages.
2. Imposta il branch di produzione su `master` e la directory di output su `/`.
3. Non serve un comando di build: il progetto è una PWA statica e la cartella `functions/` viene rilevata automaticamente da Cloudflare Pages.
4. Configura i secret JSONBin descritti sopra nel dashboard Cloudflare.
5. Esegui un nuovo deploy e verifica l'app dal dominio Pages o dal dominio personalizzato.

La Function viene pubblicata insieme al sito: `functions/api/sync.js` diventa l'endpoint `/api/sync`. Non è necessario creare o gestire un Worker separato.

Il vecchio workflow GitHub Pages (`.github/workflows/deploy.yml`) resta nel repository per riferimento, ma non è il percorso di deploy attivo e non fornisce il proxy server-side per i secret.

---

## 🧮 Algoritmo ELO

- **Rating iniziale**: 1000 punti
- **K-factor**: 32
- La **media ELO della coppia** determina il rating di squadra
- Il delta tiene conto della probabilità attesa di vittoria (differenziale compagno/avversari) e del margine di set/games vinti
- Ricalcolo automatico deterministico per garantire consistenza assoluta
