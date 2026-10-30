# 🎾 Padel Ranking PWA

PWA moderna per gestire partite di padel, serate a torneo e classifica ELO condivisa tra più dispositivi.

## ✨ Features

- 🏆 **Classifica ELO Globale** – Ranking dinamico basato sui risultati delle partite (pesi su compagno e avversari)
- ⚽ **Partite Flessibili** – Punteggio a **Set** o a **Games**, con gestione di **partite simultanee in corso**
- 🎯 **Modalità Serate / Tornei** – Calendario round-robin a 6 partite (es. 3 coppie × 2 gironi o 4 coppie), classifica interna della serata e aggiornamento automatico dell'ELO generale
- ☁️ **Sincronizzazione Multi-dispositivo (JSONBin.io)** – Condivisione automatica in cloud: inserisci i risultati da qualsiasi smartphone e tutti vedono la classifica aggiornata in tempo reale
- 👥 **Gestione Giocatori** – Aggiungi, modifica ed elimina giocatori con avatar emoji
- 💾 **Offline-first & Installabile** – Funziona anche senza connessione grazie a localStorage e Service Worker PWA

---

## ☁️ Sincronizzazione Multi-dispositivo

L'app supporta la sincronizzazione condivisa su **JSONBin.io**, configurata dall'interfaccia:
- Apri il pannello `⚙️` nell'header e inserisci **Bin ID** e **Access Key** del tuo Bin JSONBin.
- La configurazione viene salvata nel `localStorage` del dispositivo (non è nel codice).

### Come funziona:
1. **Auto-sync**: all'avvio dell'app e ad ogni salvataggio (partita, torneo, punteggio) i dati vengono sincronizzati.
2. **Polling in serata**: mentre l'app è aperta, ogni 25 secondi controlla in background se un altro giocatore ha registrato un risultato.
3. **Pulsante rapido `🔄 Sync`**: tocca il pulsante nell'header per forzare l'aggiornamento istantaneo.
4. **Pannello `⚙️`**: permette di visualizzare lo stato, scaricare o inviare manualmente i dati, o cambiare Bin ID.

---

## 🚀 Deploy su GitHub Pages

1. Carica questa cartella su un repository GitHub:
   ```bash
   git init
   git add .
   git commit -m "Padel Ranking PWA v2.1"
   git branch -M main
   git remote add origin https://github.com/<TUO-UTENTE>/<TUO-REPO>.git
   git push -u origin main
   ```
2. Nel repository GitHub, vai su **Settings → Pages**:
   - **Source**: seleziona **GitHub Actions**
3. Il file `.github/workflows/deploy.yml` pubblicherà automaticamente la PWA all'indirizzo `https://<TUO-UTENTE>.github.io/<TUO-REPO>/`

---

## 🧮 Algoritmo ELO

- **Rating iniziale**: 1000 punti
- **K-factor**: 32
- La **media ELO della coppia** determina il rating di squadra
- Il delta tiene conto della probabilità attesa di vittoria (differenziale compagno/avversari) e del margine di set/games vinti
- Ricalcolo automatico deterministico per garantire consistenza assoluta
