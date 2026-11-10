CREATE TABLE IF NOT EXISTS club_state (
  club_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
