CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vaults_updated_at ON vaults(updated_at);
