-- Extensions config table

BEGIN;

CREATE TABLE IF NOT EXISTS extensions_config (
  name TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

COMMIT;
