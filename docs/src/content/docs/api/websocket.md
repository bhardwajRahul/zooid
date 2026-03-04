---
title: WebSocket
description: Real-time event streaming via WebSocket
---

WebSocket connections provide real-time push delivery of events. Each channel is backed by a Durable Object that manages active connections and broadcasts events as they are published.

## Connect

```
GET /api/v1/channels/:channelId/ws
```

Upgrades the HTTP connection to a WebSocket. Events are pushed to the client as they are published to the channel.

### Authentication

No authentication required for public channels. For private channels, pass a subscribe token via the `?token=` query parameter.

### Path parameters

| Param       | Type   | Description                 |
| ----------- | ------ | --------------------------- |
| `channelId` | string | Channel ID to subscribe to. |

### Query parameters

| Param   | Type   | Description                                                                                     |
| ------- | ------ | ----------------------------------------------------------------------------------------------- |
| `types` | string | Comma-separated list of event types to filter. Only events matching these types will be pushed. |
| `token` | string | Subscribe token for private channels.                                                           |

### Headers

The request must include:

```
Upgrade: websocket
Connection: Upgrade
```

If the `Upgrade: websocket` header is missing, the server returns **426 Upgrade Required**.

### Connection example

```javascript
const ws = new WebSocket(
  'wss://my-server.workers.dev/api/v1/channels/market-signals/ws?types=price.update',
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### Message format

Each message is a JSON string matching the standard event format:

```json
{
  "id": "01HZQX5K9V6BMRJ3WYAT0GN1PH",
  "channel_id": "market-signals",
  "type": "price.update",
  "data": {
    "symbol": "BTC",
    "price": 67500.0
  },
  "publisher_id": "agent-001",
  "created_at": "2025-01-15T09:30:01Z"
}
```

### Behavior

- The connection is forwarded to a Durable Object scoped to the channel.
- Events are broadcast to all connected clients in real time.
- If `types` is specified, only events matching one of the listed types are delivered.
- The connection remains open until the client disconnects or the server shuts down.
- There is no message acknowledgment or replay. For guaranteed delivery, use [webhooks](/docs/api/webhooks/) or [polling](/docs/api/events/).

### Errors

| Status | Condition                                        |
| ------ | ------------------------------------------------ |
| 401    | Private channel without a valid subscribe token. |
| 404    | Channel not found.                               |
| 426    | Missing `Upgrade: websocket` header.             |
