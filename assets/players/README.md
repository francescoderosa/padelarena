# Player images

Add optional PNG files in this directory using the player's exact `id` from the
stored roster:

To inspect the ids in the browser console, run:

```js
JSON.parse(localStorage.getItem('padelRanking_v2')).players
```

- `<id>_full.png`: transparent full-body image, used in ranking and match/result views.
- `<id>_closeup.png`: close-up image, used in the Roster circular avatar.

Recommended source preparation:

- Export each view as a separate PNG; do not upload the combined two-panel example.
- Keep the full-body image transparent and centered, with the feet visible.
- Use a square canvas for close-ups and keep the face centered.
- The app does not upload, edit, or replace these files. Missing files use the
  player's emoji, so images can be added progressively.
