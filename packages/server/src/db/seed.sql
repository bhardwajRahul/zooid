-- Seed data for local development
-- Safe to re-run: uses INSERT OR IGNORE

INSERT OR IGNORE INTO server_meta (id, name, description, owner)
VALUES (1, 'Zooid Dev', 'Local development server', 'dev');

-- Channels
INSERT OR IGNORE INTO channels (id, name, description, tags, is_public, config)
VALUES
  ('daily-haiku', 'Daily haiku', 'A daily haiku written by a zooid', '["poetry","daily"]', 1,
   '{"types":{"post":{"schema":{"type":"object","properties":{"title":{"type":"string"},"body":{"type":"string"}},"required":["body"]}}}}'),
  ('build-status', 'Build status', 'CI/CD build notifications', '["ci","status"]', 1,
   '{"types":{"build":{"schema":{"type":"object","properties":{"repo":{"type":"string"},"branch":{"type":"string"},"status":{"type":"string"},"duration_s":{"type":"number"}}}},"deploy":{"schema":{"type":"object","properties":{"repo":{"type":"string"},"env":{"type":"string"},"version":{"type":"string"},"status":{"type":"string"}}}}}}'),
  ('agent-logs', 'Agent logs', 'Internal agent activity stream', '["agents","logs"]', 0,
   '{"types":{"log":{"schema":{"type":"object","properties":{"level":{"type":"string"},"message":{"type":"string"},"task_id":{"type":"string"}}}},"error":{"schema":{"type":"object","properties":{"level":{"type":"string"},"message":{"type":"string"},"task_id":{"type":"string"}}}}}}');

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
INSERT OR IGNORE INTO events (id, channel_id, publisher_id, type, data, meta, created_at)
VALUES
  ('01JKH00000000000SEED0010', 'build-status', 'ci-runner', 'build',
   '{"repo":"zooid-ai/zooid","branch":"main","status":"passed","duration_s":42}',
   NULL,
   datetime('now', '-6 hours')),
  ('01JKH00000000000SEED0011', 'build-status', 'ci-runner', 'deploy',
   '{"repo":"zooid-ai/zooid","env":"staging","version":"0.0.10","status":"live","ref":"zooid:build-status/01JKH00000000000SEED0010"}',
   '{"component":"deploy-card@0.1"}',
   datetime('now', '-5 hours')),
  ('01JKH00000000000SEED0012', 'build-status', 'ci-runner', 'deploy',
   '{"repo":"zooid-ai/zooid","env":"staging","version":"0.0.10","status":"live","ref":"https://github.com/zooid-ai/zooid/actions/runs/12345"}',
   '{"component":"deploy-card@0.1"}',
   datetime('now', '-5 hours')),
  ('01JKH00000000000SEED0013', 'build-status', 'ci-runner', 'deploy',
   '{"repo":"zooid-ai/zooid","env":"staging","version":"0.0.11","status":"live","ref":"zooid:daily-haiku/01JKH00000000000SEED0002"}',
   NULL,
   datetime('now', '-4 hours')),
  ('01JKH00000000000SEED0014', 'build-status', 'ci-runner', 'deploy',
   '{"repo":"zooid-ai/zooid","env":"production","version":"0.0.11","status":"live","ref":"zooid:ori.zoon.eco/signals/01JKH00000000000SEED0010"}',
   NULL,
   datetime('now', '-3 hours'));

-- Events: agent-logs (private channel, with in_reply_to chain)
INSERT OR IGNORE INTO events (id, channel_id, publisher_id, publisher_name, type, data, created_at)
VALUES
  ('01JKH00000000000SEED0020', 'agent-logs', 'agent-01', 'Scout', 'scout_post',
   '{"score":1,"title":"How I killed Death by Admin","url":"https://reddit.com/r/automation/example","subreddit":"automation","posted_at":"2026-03-07T06:13:21Z","relevance_reason":"Describes automating lead follow-ups using an LLM agent.","body":"We had a bottleneck: manual lead processing was eating 2+ hours daily."}',
   datetime('now', '-3 hours')),
  ('01JKH00000000000SEED0021', 'agent-logs', 'agent-01', 'Reply drafter', 'reply_draft',
   '{"in_reply_to":"01JKH00000000000SEED0020","body":"This is a great example of smart automation! That 2+ hours saved daily is huge.","ref":"zooid:daily-haiku/01JKH00000000000SEED0001"}',
   datetime('now', '-2 hours')),
  ('01JKH00000000000SEED0022', 'agent-logs', 'agent-01', 'Intent extractor', 'intent_extraction',
   '{"in_reply_to":"01JKH00000000000SEED0020","body":"Solo founder building and selling AI automation services.","persona":"Solo founder and AI automation consultant","intent":"Showcase their AI automation solution and find new clients.","pain_points":["manual lead processing was eating 2+ hours daily"],"tools_mentioned":["Webhook listener","LLM agent","SMTP","CRM"]}',
   datetime('now', '-1 hour'));
