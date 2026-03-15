export interface Migration {
  version: number;
  sql: string;
}

export const CHANNEL_MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        publisher_id TEXT,
        publisher_name TEXT,
        type TEXT,
        reply_to TEXT,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_reply_to ON events(reply_to);
      CREATE INDEX IF NOT EXISTS idx_events_publisher ON events(publisher_id);

      CREATE TABLE IF NOT EXISTS thread_ancestors (
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        ancestor_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        depth INTEGER NOT NULL,
        PRIMARY KEY (event_id, ancestor_id)
      );
      CREATE INDEX IF NOT EXISTS idx_thread_descendants
        ON thread_ancestors(ancestor_id, depth);

      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        event_types TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_url ON webhooks(url);
    `,
  },
];
