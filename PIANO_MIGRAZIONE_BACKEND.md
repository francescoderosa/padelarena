# Piano migrazione backend e piattaforma account

Documento operativo da aggiornare durante l'evoluzione del progetto.

## Decisioni correnti

- Il Club Service gestisce i dati sportivi del club: players, matches,
  tournaments, ranking ed eventi.
- Il Club Service non gestisce inizialmente la tabella `clubs`.
- `clubs`, account, autenticazione, membership, ruoli e ownership appartengono
  alla piattaforma centrale Account Service.
- Nella prima fase il Club Service puo' usare un `clubId` tecnico/configurato,
  senza implementare login o permessi propri.
- `player` e `account` restano entita' separate. Un player puo' avere un
  `account_id` nullo fino al collegamento successivo.
- La migrazione da JSONBin a D1 viene fatta prima della normalizzazione in
  tabelle.
- La scelta del database tabellare resta aperta tra D1, PostgreSQL gestito su
  Cloudflare e Supabase/PostgreSQL.
- La scelta tabellare deve considerare anche la tecnologia futura
  dell'Account Service, senza accoppiare i due domini per convenienza tecnica.

## Stato avanzamento

- [x] Correggere la visualizzazione delle partite torneo nell'area Battaglie.
- [x] Raggruppare i matchup torneo per turni.
- [x] Persistenza e riapertura dei risultati parziali.
- [ ] Creare il branch della migrazione JSONBin -> D1.
- [ ] Sostituire JSONBin con una riga D1 mantenendo `/api/sync`.
- [ ] Importare e verificare lo stato esistente.
- [ ] Separare la persistenza dal codice UI.
- [ ] Definire il contratto Club Service con `clubId`.
- [ ] Definire il contratto Account Service / Club Service.
- [ ] Decidere il database tabellare.
- [ ] Migrare progressivamente players, matches e tournaments in tabelle.
- [ ] Collegare account, membership, ruoli e ownership tramite Account Service.

## Fase 1: D1 con stato JSON

### Obiettivo

Sostituire JSONBin con una tabella D1 che contiene lo stato corrente del club,
senza cambiare subito il contratto frontend `/api/sync`.

Schema minimo indicativo:

```text
club_state
  club_id
  state_json
  schema_version
  revision
  updated_at
```

Il database D1 gia' configurato puo' essere riutilizzato inizialmente,
lasciando `push_subscriptions` separata da `club_state`. Il binding
`PUSH_DB` potra' essere rinominato in seguito, se necessario.

### Vantaggi

- Rimuove subito la dipendenza da JSONBin.
- Mantiene quasi invariato il frontend.
- Non richiede nuova infrastruttura.
- Introduce una base per `clubId`, versione, revisione e timestamp.

### Limiti

- Stato ancora documentale e last-write-wins se non si aggiunge controllo
  della revisione.
- Nessuna query parziale efficiente.
- Nessun audit o aggiornamento per entita'.
- Il payload deve restare entro il limite dimensionale di D1.

### Effort indicativo

1-3 giorni di lavoro effettivo, inclusi migrazione SQL, Function, import,
test dev e produzione.

## Fase 2: Club Service tabellare

La tabella `clubs` non fa parte del primo schema del Club Service. Il club
corrente viene risolto dalla piattaforma centrale o, temporaneamente, da una
configurazione tecnica.

Tabelle iniziali possibili:

```text
players
matches
tournaments
tournament_couples
tournament_matchups
ranking_events
events
```

Tabelle da valutare solo con il contratto Account Service:

```text
player_accounts
notifications
```

Il Club Service puo' salvare riferimenti come `account_id` o `membership_id`,
ma non deve diventare proprietario di autenticazione, membership o ruoli.

### Effort indicativo

3-6 settimane per uno schema iniziale completo, API, repository frontend,
import, gestione degli errori e test. Una prima tranche limitata a players,
matches e tournaments puo' essere piu' breve.

## Scelta database tabellare

### D1

Scelta adatta se il Club Service resta vicino a Cloudflare Pages/Functions.
Ha continuita' infrastrutturale, costi bassi e capacita' sufficiente per il
carico previsto. Richiede pero' API, autorizzazione, transazioni applicative
e strumenti di dominio implementati dal progetto.

### PostgreSQL gestito su Cloudflare

Da valutare separatamente da D1. Offre il modello relazionale PostgreSQL e
puo' ridurre la distanza da query, vincoli e report piu' complessi, mantenendo
pero' parte dell'ecosistema Cloudflare. Vanno verificati prima del commitment:

- prodotto Cloudflare preciso e livello di maturita';
- compatibilita' con Pages Functions e runtime scelto;
- pooling e gestione delle connessioni;
- migrazioni, backup, restore e osservabilita';
- costi, limiti e latenza;
- strategia di autenticazione e autorizzazione.

### Supabase/PostgreSQL

Da preferire se l'Account Service adottera' gia' Supabase Auth/PostgreSQL o se
servono rapidamente dashboard, Row Level Security, API generate e realtime.
Non va scelto solo per usare Auth: l'Account Service resta un dominio
centrale da progettare indipendentemente.

### Criterio decisionale

La scelta deve essere presa quando sono noti:

1. contratto Account Service / Club Service;
2. requisiti multi-club e autorizzazione;
3. query, audit, report e realtime necessari;
4. tecnologia e hosting dell'Account Service;
5. requisiti operativi di backup, migrazione e osservabilita'.

## Urgenza

- JSONBin -> D1: urgenza alta per affidabilita' e architettura, non per
  capacita' o quote.
- D1 JSON -> tabelle: urgenza media; diventa alta con multi-club, ruoli,
  audit, notifiche personalizzate, query o concorrenza significativa.
- Account Service: va progettato ora, ma non deve bloccare la migrazione D1.
  Va implementato prima di login, membership, ownership e permessi reali.

## Sequenza prevista

```text
D1 con stato JSON
        -> clubId e contratto tecnico
        -> contratto Account Service / Club Service
        -> scelta D1, PostgreSQL Cloudflare o Supabase
        -> Club Service tabellare
        -> integrazione account, membership e ruoli
```
