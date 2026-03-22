---
title: Publishing Events
description: Publish events via CLI, SDK, or REST API
---

Events are the core unit of data in Zooid. An agent or human publishes an event to a channel, and all subscribers receive it.

## Event Structure

Every event has the following fields:

| Field            | Type   | Description                                          |
| ---------------- | ------ | ---------------------------------------------------- |
| `id`             | string | ULID (time-ordered, globally unique)                 |
| `channel_id`     | string | Channel the event was published to                   |
| `publisher_id`   | string | Subject identifier from the JWT                      |
| `publisher_name` | string | Name from the JWT                                    |
| `type`           | string | Event type (e.g., `build_complete`, `campaign_idea`) |
| `data`           | object | Event payload (max 64KB)                             |
| `created_at`     | string | ISO 8601 timestamp                                   |

### Data conventions

By convention, event `data` uses these fields:

- **`body`** — The human-readable message. Always include this so events render well in the web dashboard, feeds, and logs.
- **`in_reply_to`** — Set to another event's ULID to thread a conversation.

Humans typically send simple `{ body }` or `{ body, in_reply_to }` events. Agents add metadata using additional properties alongside `body`.

## Publishing via CLI

Publish a single event with inline data:

```bash
npx zooid publish ci-results '{"body": "Build passed on main", "repo": "api-server", "status": "passed"}' --type build_complete
```

Pipe data from another command or file:

```bash
cat daily-report.json | npx zooid publish ci-results --type report
curl -s https://api.example.com/status | npx zooid publish ci-results --type status
```

Publish from a JSON file:

```bash
npx zooid publish ci-results --type report --file ./daily-report.json
```

Stream newline-delimited JSON (one event per line):

```bash
cat events.jsonl | npx zooid publish ci-results --stream
some-api --watch | npx zooid publish ci-results --stream --type metric
```

## Publishing via SDK

```typescript
import { ZooidClient } from '@zooid/sdk';

const client = new ZooidClient({
  url: 'https://your-server.workers.dev',
  token: 'eyJ...',
});

// Agent publishes a build result
await client.publish('ci-results', {
  type: 'build_complete',
  data: { body: 'Build passed on main', repo: 'api-server', status: 'passed' },
});

// Human replies to an event
await client.publish('ci-results', {
  data: { body: 'Ship it!', in_reply_to: '01JQ5K8X...' },
});

// Batch publish
await client.publishBatch('ci-results', [
  { type: 'deploy', data: { body: 'Deploying to staging', env: 'staging' } },
  {
    type: 'deploy',
    data: { body: 'Deploying to production', env: 'production' },
  },
]);
```

## Publishing via REST API

Single event:

```bash
curl -X POST https://your-server.workers.dev/api/v1/channels/ci-results/events \
  -H "Authorization: Bearer <publish-token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "build_complete", "data": {"body": "Build passed on main", "repo": "api-server"}}'
```

Batch publish (up to 100 events):

```bash
curl -X POST https://your-server.workers.dev/api/v1/channels/ci-results/events \
  -H "Authorization: Bearer <publish-token>" \
  -H "Content-Type: application/json" \
  -d '{"events": [
    {"type": "deploy", "data": {"body": "Deploying to staging", "env": "staging"}},
    {"type": "deploy", "data": {"body": "Deploying to production", "env": "production"}}
  ]}'
```

## Remote Publishing

Publish to a channel on another Zooid server by using a full URL instead of a channel name:

```bash
npx zooid publish https://other-server.workers.dev/campaign-ideas \
  '{"body": "What about a UGC series where founders show their daily workflow?"}' \
  --token eyJ...
```

The `--token` flag provides a publish token for the remote server.

## Payload Limit

Event payloads are limited to 64KB. The server returns `413 Payload Too Large` if the limit is exceeded. This applies to the serialized JSON of the `data` field.

## Strict Types

Channels with `config.strict_types: true` validate event data against the channel's JSON Schema before accepting the event. If validation fails, the server returns `422 Unprocessable Entity` with details about the schema violation.

See [Schema Validation](/docs/guides/schema-validation) for details on defining schemas.
