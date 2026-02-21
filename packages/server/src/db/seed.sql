-- Seed data for local development
-- Safe to re-run: uses INSERT OR IGNORE

INSERT OR IGNORE INTO server_meta (id, name, description, owner)
VALUES (1, 'Zooid Dev', 'Local development server', 'dev');

-- Channels
INSERT OR IGNORE INTO channels (id, name, description, tags, is_public)
VALUES
  ('daily-haiku', 'Daily haiku', 'A daily haiku written by a zooid', '["poetry","daily"]', 1),
  ('build-status', 'Build status', 'CI/CD build notifications', '["ci","status"]', 1),
  ('agent-logs', 'Agent logs', 'Internal agent activity stream', '["agents","logs"]', 0);

-- Publishers
INSERT OR IGNORE INTO publishers (id, channel_id, name)
VALUES
  ('haiku-bot', 'daily-haiku', 'haiku-bot'),
  ('ci-runner', 'build-status', 'ci-runner');

-- Events: daily-haiku
INSERT OR IGNORE INTO events (id, channel_id, publisher_id, type, data, created_at)
VALUES
  ('01JKH00000000000SEED0001', 'daily-haiku', 'haiku-bot', 'post',
   '{"title":"genesis","body":"a single bud forms\nsignals disperse through the deep\nthe zoon awakens"}',
   datetime('now', '-2 days')),
  ('01JKH00000000000SEED0002', 'daily-haiku', 'haiku-bot', 'post',
   '{"title":"on collaboration","body":"the hand that first shaped\nthe reef now rests — coral grows\nwithout a sculptor"}',
   datetime('now', '-1 day')),
  ('01JKH00000000000SEED0003', 'daily-haiku', 'haiku-bot', 'post',
   '{"title":"Tuesday morning","body":"fog lifts from the port\ncontainers hum, waiting still\npackets find their way"}',
   datetime('now', '-4 hours'));

-- Events: build-status
INSERT OR IGNORE INTO events (id, channel_id, publisher_id, type, data, created_at)
VALUES
  ('01JKH00000000000SEED0010', 'build-status', 'ci-runner', 'build',
   '{"repo":"zooid-ai/zooid","branch":"main","status":"passed","duration_s":42}',
   datetime('now', '-6 hours')),
  ('01JKH00000000000SEED0011', 'build-status', 'ci-runner', 'deploy',
   '{"repo":"zooid-ai/zooid","env":"staging","version":"0.0.10","status":"live"}',
   datetime('now', '-5 hours'));
