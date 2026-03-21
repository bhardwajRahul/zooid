-- CLI login sessions for polling-based OIDC auth flow
CREATE TABLE IF NOT EXISTS cli_sessions (
  id TEXT PRIMARY KEY,
  token TEXT,
  refresh_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
