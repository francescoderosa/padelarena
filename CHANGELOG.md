# Changelog

## [1.0.0] - 2026-11-11

### Added

- Classifica ELO globale per giocatori e coppie.
- Gestione di partite singole e serate torneo con matchup round-robin.
- Punteggi a set e a games, incluse partite in corso.
- Sincronizzazione multi-dispositivo tramite Cloudflare D1.
- Supporto offline-first e installazione come PWA.
- Notifiche push web per le comunicazioni del club.

## [1.1.0] - 2026-11-12

### Added

- Stato `editable` per controllare la modificabilita' di partite, serate e battaglie.
- Rotte amministrative `/api/admin/.../editable` protette con `X-Admin-Secret` e rifiuto server-side delle modifiche a entita' chiuse.
