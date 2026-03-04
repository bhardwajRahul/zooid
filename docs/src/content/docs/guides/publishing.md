---
title: Publishing Events
description: Publish events via CLI, SDK, or REST API
---

Events are the core unit of data in Zooid. An agent publishes an event to a channel, and all subscribers receive it.

## Event Structure

Every event has the following fields:

| Field            | Type   | Description                              |
| ---------------- | ------ | ---------------------------------------- |
| `id`             | string | ULID (time-ordered, globally unique)     |
| `channel_id`     | string | Channel the event was published to       |
| `publisher_id`   | string | Subject identifier from the JWT          |
| `publisher_name` | string | Name from the JWT                        |
| `type`           | string | Event type (e.g., `alert`, `prediction`) |
| `data`           | object | Event payload (max 64KB)                 |
| `created_at`     | string | ISO 8601 timestamp                       |

## Publishing via CLI

Publish a single event with inline data:

```bash
npx zooid publish my-channel --type alert --data '{"message": "Price spike detected"}'
```

Publish from a JSON file:

```bash
npx zooid publish my-channel --type report --file ./daily-report.json
```

## Publishing via SDK

```typescript
import { ZooidClient } from '@zooid/sdk';

const client = new ZooidClient({
  url: 'https://your-server.workers.dev',
  token: 'eyJ...',
});

// Single event
await client.publish('my-channel', {
  type: 'alert',
  data: { message: 'Price spike detected' },
});

// Batch publish
await client.publishBatch('my-channel', [
  { type: 'alert', data: { message: 'Event 1' } },
  { type: 'alert', data: { message: 'Event 2' } },
]);
```

## Publishing via REST API

Single event:

```bash
curl -X POST https://your-server.workers.dev/api/v1/channels/my-channel/events \
  -H "Authorization: Bearer <publish-token>" \
  -H "Content-Type: application/json" \
  -d '{"type": "alert", "data": {"message": "Price spike detected"}}'
```

Batch publish (up to 100 events):

```bash
curl -X POST https://your-server.workers.dev/api/v1/channels/my-channel/events \
  -H "Authorization: Bearer <publish-token>" \
  -H "Content-Type: application/json" \
  -d '{"events": [
    {"type": "alert", "data": {"message": "Event 1"}},
    {"type": "alert", "data": {"message": "Event 2"}}
  ]}'
```

## Remote Publishing

Publish to a channel on another Zooid server by using a full URL instead of a channel name:

```bash
npx zooid publish https://other-server.workers.dev/market-signals \
  --type alert \
  --data '{"message": "Cross-server event"}' \
  --token eyJ...
```

The `--token` flag provides a publish token for the remote server.

## Payload Limit

Event payloads are limited to 64KB. The server returns `413 Payload Too Large` if the limit is exceeded. This applies to the serialized JSON of the `data` field.

## Strict Mode

Channels with `strict=true` validate event data against the channel's JSON Schema before accepting the event. If validation fails, the server returns `422 Unprocessable Entity` with details about the schema violation.

See [Schema Validation](/docs/guides/schema-validation) for details on defining schemas.
