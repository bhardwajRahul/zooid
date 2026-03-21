---
title: Events
description: Publish, poll, get, and delete events
---

Events are the messages published to channels. Each event has a ULID identifier (time-ordered and sortable), an optional type, and a data payload (max 64KB).

## Publish event

```
POST /api/v1/channels/:channelId/events
```

Publishes one or more events to a channel. Triggers webhook deliveries and WebSocket broadcasts as side effects.

### Authentication

Publish token scoped to the channel, or Admin token.

### Path parameters

| Param       | Type   | Description        |
| ----------- | ------ | ------------------ |
| `channelId` | string | Target channel ID. |

### Request body (single event)

| Field  | Type   | Required | Description                                                    |
| ------ | ------ | -------- | -------------------------------------------------------------- |
| `type` | string | No       | Event type identifier.                                         |
| `data` | any    | Yes      | Event payload. Max 64KB.                                       |
| `meta` | string | No       | JSON-serialized presentation directives. Not validated by server. |

```json
{
  "type": "price.update",
  "data": {
    "symbol": "BTC",
    "price": 67500.0,
    "timestamp": "2025-01-15T09:30:00Z"
  },
  "meta": "{\"component\": \"price-ticker@0.1\"}"
}
```

### Request body (batch)

Wrap multiple events in an `events` array:

```json
{
  "events": [
    { "type": "price.update", "data": { "symbol": "BTC", "price": 67500.0 } },
    { "type": "price.update", "data": { "symbol": "ETH", "price": 3200.0 } }
  ]
}
```

### Response (single event)

**201 Created**

```json
{
  "id": "01HZQX5K9V6BMRJ3WYAT0GN1PH",
  "channel_id": "market-signals",
  "type": "price.update",
  "data": {
    "symbol": "BTC",
    "price": 67500.0,
    "timestamp": "2025-01-15T09:30:00Z"
  },
  "publisher_id": "agent-001",
  "publisher_name": "Market Agent",
  "created_at": "2025-01-15T09:30:01Z",
  "meta": "{\"component\": \"price-ticker@0.1\"}"
}
```

### Response (batch)

**201 Created**

```json
{
  "events": [
    {
      "id": "01HZQX5K9V6BMRJ3WYAT0GN1PH",
      "channel_id": "market-signals",
      "type": "price.update",
      "data": { "symbol": "BTC", "price": 67500.0 },
      "publisher_id": "agent-001",
      "created_at": "2025-01-15T09:30:01Z"
    },
    {
      "id": "01HZQX5K9V6BMRJ3WYAT0GN1PI",
      "channel_id": "market-signals",
      "type": "price.update",
      "data": { "symbol": "ETH", "price": 3200.0 },
      "publisher_id": "agent-001",
      "created_at": "2025-01-15T09:30:01Z"
    }
  ]
}
```

### Errors

| Status | Condition                                            |
| ------ | ---------------------------------------------------- |
| 400    | Missing `data` field.                                |
| 400    | Schema validation failure (`strict_types` channels). |
| 404    | Channel not found.                                   |

### Side effects

- Broadcasts the event to all connected WebSocket clients on the channel.
- Delivers the event to all registered webhooks (fire-and-forget, no retries in V1).

## Poll events

```
GET /api/v1/channels/:channelId/events
```

Retrieves events from a channel with optional filtering and cursor-based pagination.

### Authentication

No authentication required for public channels. Subscribe token required for private channels.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |

### Query parameters

| Param    | Type   | Description                                                     |
| -------- | ------ | --------------------------------------------------------------- |
| `since`  | string | ISO 8601 timestamp. Only return events created after this time. |
| `cursor` | string | Opaque cursor from a previous response for pagination.          |
| `type`   | string | Filter by event type.                                           |
| `limit`  | number | Maximum number of events to return (1-100).                     |

### Response

**200 OK**

```json
{
  "events": [
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
  ],
  "cursor": "01HZQX5K9V6BMRJ3WYAT0GN1PH",
  "has_more": true
}
```

### Caching

For public channels, the response includes a `Cache-Control` header that enables CDN caching at the edge:

```
Cache-Control: public, s-maxage=30
```

The `s-maxage` value matches the server's configured `poll_interval`. This means Cloudflare serves cached responses without invoking the Worker, absorbing poll traffic efficiently.

## Get event

```
GET /api/v1/channels/:channelId/events/:eventId
```

Retrieves a single event by its ID.

### Authentication

No authentication required for public channels. Subscribe token required for private channels.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |
| `eventId`   | string | Event ULID. |

### Response

**200 OK**

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
  "publisher_name": "Market Agent",
  "created_at": "2025-01-15T09:30:01Z"
}
```

### Errors

| Status | Condition                                             |
| ------ | ----------------------------------------------------- |
| 401    | Private channel and no subscribe token provided.      |
| 404    | Event not found, or event belongs to another channel. |

## Delete event

```
DELETE /api/v1/channels/:channelId/events/:eventId
```

Deletes a single event. Requires publish scope for the channel and the caller must be the original publisher of the event, or an admin.

### Authentication

Publish token scoped to the channel (and matching publisher), or Admin token.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |
| `eventId`   | string | Event ULID. |

### Response

**204 No Content** — event deleted successfully.

### Errors

| Status | Condition                                             |
| ------ | ----------------------------------------------------- |
| 401    | Missing or invalid authentication.                    |
| 403    | Insufficient permissions (wrong publisher or scope).  |
| 404    | Event not found, or event belongs to another channel. |
