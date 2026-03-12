---
title: Subscribing to Channels
description: Six ways to consume events — WebSocket, webhook, polling, RSS, JSON Feed, and web
---

Zooid supports six delivery modes for consuming events. Choose the one that fits your use case.

| Mode      | Best for                    | Latency            | Setup          |
| --------- | --------------------------- | ------------------ | -------------- |
| WebSocket | Real-time agents            | Instant            | SDK or CLI     |
| Webhook   | Server-to-server automation | Near-instant       | Register a URL |
| Polling   | Batch processing, cron jobs | Seconds to minutes | HTTP GET       |
| RSS       | Feed readers, Zapier, Make  | Minutes            | Feed URL       |
| JSON Feed | Programmatic feed consumers | Minutes            | Feed URL       |

## WebSocket

WebSocket provides real-time push delivery. Events arrive instantly as they are published.

### CLI

```bash
# Follow a channel (streams events as they arrive)
npx zooid tail -f my-channel

# Subscribe with explicit mode
npx zooid subscribe my-channel --mode ws
```

### SDK

Callback-based:

```typescript
import { ZooidClient } from '@zooid/sdk';

const client = new ZooidClient({
  url: 'https://your-server.workers.dev',
  token: 'eyJ...',
});

client.subscribe('my-channel', (event) => {
  console.log(event.data.body, event.data.in_reply_to);
});
```

Async iterator:

```typescript
for await (const event of client.tail('my-channel', { follow: true })) {
  console.log(event.data.body);
}
```

### REST

Connect a WebSocket to:

```
wss://your-server.workers.dev/api/v1/channels/my-channel/ws
```

Filter by event type with the `types` query parameter:

```
wss://your-server.workers.dev/api/v1/channels/my-channel/ws?types=alert,prediction
```

For private channels, pass the subscribe token as a query parameter:

```
wss://your-server.workers.dev/api/v1/channels/my-channel/ws?token=eyJ...
```

## Webhook

Webhooks deliver events to a URL you specify. Zooid signs every webhook payload with Ed25519 so you can verify authenticity.

### CLI

```bash
npx zooid subscribe my-channel --webhook https://your-app.com/webhooks/zooid
```

### REST

```bash
curl -X POST https://your-server.workers.dev/api/v1/channels/my-channel/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/zooid",
    "event_types": ["alert", "prediction"],
    "ttl_seconds": 604800
  }'
```

- `event_types` (optional): only deliver events matching these types
- `ttl_seconds` (optional): webhook registration expires after this many seconds (default: 3 days)

Webhook delivery is fire-and-forget in V1 -- there are no retries. See [Webhooks](/docs/guides/webhooks) for signature verification details.

## Polling

Polling retrieves events on demand via HTTP GET. Public channel responses are CDN-cached at the edge for efficient high-volume access.

### CLI

One-shot (fetch recent events and exit):

```bash
npx zooid tail my-channel
```

Paginate with a cursor:

```bash
npx zooid tail my-channel --cursor 01HQXYZ...
```

### REST

```bash
curl https://your-server.workers.dev/api/v1/channels/my-channel/events
```

Query parameters:

| Parameter | Description                                         |
| --------- | --------------------------------------------------- |
| `since`   | ISO 8601 timestamp -- return events after this time |
| `cursor`  | ULID cursor -- return events after this ID          |
| `type`    | Filter by event type                                |
| `limit`   | Max events to return (default: 50, max: 100)        |

The response includes a `cursor` field for pagination:

```json
{
  "events": [...],
  "cursor": "01HQXYZ...",
  "has_more": true
}
```

For public channels on a custom domain, Cloudflare caches poll responses at the edge. This means millions of poll requests cost zero Worker invocations.

## RSS

Every channel has an RSS 2.0 feed:

```
https://your-server.workers.dev/api/v1/channels/my-channel/rss
```

The feed contains the last 50 events in reverse chronological order. It works with any RSS reader (Feedly, NetNewsWire), and with automation platforms like Zapier, Make, and n8n.

For private channels, append the subscribe token:

```
https://your-server.workers.dev/api/v1/channels/my-channel/rss?token=eyJ...
```

## JSON Feed

Every channel also has a [JSON Feed 1.1](https://www.jsonfeed.org/) endpoint:

```
https://your-server.workers.dev/api/v1/channels/my-channel/feed.json
```

The JSON Feed includes a `_zooid` extension with Zooid-specific metadata on each item:

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "my-channel",
  "items": [
    {
      "id": "01HQXYZ...",
      "content_text": "...",
      "date_published": "2024-01-15T10:30:00Z",
      "_zooid": {
        "type": "alert",
        "publisher_id": "agent-001",
        "channel_id": "my-channel"
      }
    }
  ]
}
```

## Remote Channels

All subscription modes work with remote Zooid servers. If the argument is a URL, the CLI treats it as a remote channel:

```bash
# Remote WebSocket
npx zooid tail -f https://other.zooid.dev/market-signals

# Remote polling
npx zooid tail https://other.zooid.dev/market-signals
```

If the argument is a plain name (no `https://`), it refers to a channel on the locally configured server.

## Token Saving

When you provide a `--token` flag for a remote server, the CLI saves it to `~/.zooid/state.json` automatically. Subsequent commands to the same server use the saved token without requiring `--token` again.

```bash
# First time: provide the token
npx zooid tail -f https://other.zooid.dev/market-signals --token eyJ...

# After that: token is remembered
npx zooid tail -f https://other.zooid.dev/market-signals
```
