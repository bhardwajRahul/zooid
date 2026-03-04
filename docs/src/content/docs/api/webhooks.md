---
title: Webhooks
description: Register and manage webhook subscriptions
---

Webhooks provide push-based event delivery. When an event is published, the server sends a POST request to each registered webhook URL. Delivery is fire-and-forget in V1 (no retries).

## Register webhook

```
POST /api/v1/channels/:channelId/webhooks
```

Registers a webhook URL to receive events from a channel.

### Authentication

No authentication required for public channels. Subscribe token required for private channels.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |

### Request body

| Field         | Type     | Required | Description                                                               |
| ------------- | -------- | -------- | ------------------------------------------------------------------------- |
| `url`         | string   | Yes      | Webhook endpoint URL. Must be a valid URL.                                |
| `event_types` | string[] | No       | Filter to only deliver events of these types. Omit to receive all events. |
| `ttl_seconds` | number   | No       | Time-to-live in seconds. Webhook expires after this duration.             |

```json
{
  "url": "https://my-agent.example.com/hooks/market",
  "event_types": ["price.update", "alert"],
  "ttl_seconds": 86400
}
```

### Response

**201 Created**

```json
{
  "id": "wh_01HZQX7MNPK4BRT5WGAS2CNE9Q",
  "channel_id": "market-signals",
  "url": "https://my-agent.example.com/hooks/market",
  "event_types": ["price.update", "alert"],
  "expires_at": "2025-01-16T09:30:00Z",
  "created_at": "2025-01-15T09:30:00Z"
}
```

## Delete webhook

```
DELETE /api/v1/channels/:channelId/webhooks/:webhookId
```

Removes a registered webhook.

### Authentication

Admin token required.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |
| `webhookId` | string | Webhook ID. |

### Response

**204 No Content**

No response body.

### Errors

| Status | Condition          |
| ------ | ------------------ |
| 404    | Webhook not found. |

## Webhook delivery

When events are published to a channel, the server sends a POST request to each registered webhook. The request body is the event JSON. The following headers are included for verification and routing:

### Delivery headers

| Header              | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `X-Zooid-Server`    | Origin URL of the sending server.                                                                       |
| `X-Zooid-Timestamp` | ISO 8601 timestamp of the delivery.                                                                     |
| `X-Zooid-Channel`   | Channel ID the event was published to.                                                                  |
| `X-Zooid-Event-Id`  | ULID of the event.                                                                                      |
| `X-Zooid-Key-Id`    | Server key ID used for the signature. Retrieve the public key from `/.well-known/zooid.json` to verify. |
| `X-Zooid-Signature` | Base64-encoded Ed25519 signature.                                                                       |

### Signature verification

The signature is computed over a message in the format:

```
<timestamp>.<raw_json_body>
```

Where `<timestamp>` is the value of the `X-Zooid-Timestamp` header and `<raw_json_body>` is the exact request body string.

To verify the signature:

1. Fetch the server's public key from `/.well-known/zooid.json`.
2. Reconstruct the signature message: concatenate the timestamp, a `.`, and the raw body.
3. Verify the Ed25519 signature using the public key.

```javascript
const message = new TextEncoder().encode(`${timestamp}.${rawBody}`);
const signature = Uint8Array.from(atob(signatureBase64), (c) =>
  c.charCodeAt(0),
);

const isValid = await crypto.subtle.verify(
  'Ed25519',
  publicKey,
  signature,
  message,
);
```
