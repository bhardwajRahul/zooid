---
title: Webhooks
description: Register webhooks and verify Ed25519 signatures
---

Webhooks deliver events to a URL as HTTP POST requests. Every webhook payload is signed with Ed25519 so consumers can verify that the event came from a legitimate Zooid server.

## Registering a Webhook

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
    "event_types": ["alert"],
    "ttl_seconds": 604800
  }'
```

- `url` (required): the HTTPS endpoint to receive events
- `event_types` (optional): array of event types to filter. Omit to receive all events.
- `ttl_seconds` (optional): how long the registration lives. Default is 259200 (3 days).

## Webhook Delivery

When an event is published, Zooid delivers it to all registered webhooks for that channel. Delivery uses `waitUntil()` to fan out without blocking the publish response.

In V1, delivery is fire-and-forget. There are no retries. If your endpoint is down, the event is not re-delivered. Design your consumer to handle missed events by backfilling via polling.

## Request Headers

Every webhook request includes these headers:

| Header              | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `X-Zooid-Signature` | Ed25519 signature of the payload                        |
| `X-Zooid-Timestamp` | Unix timestamp (seconds) when the signature was created |
| `X-Zooid-Channel`   | Channel ID the event belongs to                         |
| `X-Zooid-Event-Id`  | ULID of the event                                       |
| `X-Zooid-Key-Id`    | ID of the signing key                                   |
| `X-Zooid-Server`    | Server ID of the sending server                         |

The request body is the full event object as JSON.

## Signature Verification

Zooid signs webhooks with Ed25519 (asymmetric). The server holds the private key; consumers verify with the public key. No shared secrets are exchanged.

### Signature Format

The signed message is constructed as:

```
<timestamp>.<raw_json_body>
```

Where `<timestamp>` matches the `X-Zooid-Timestamp` header and `<raw_json_body>` is the raw request body.

### Getting the Public Key

The server publishes its public key at:

```
https://your-server.workers.dev/.well-known/zooid.json
```

```json
{
  "server_id": "srv_01HQXYZ...",
  "public_key": "base64-encoded-ed25519-public-key",
  "version": "0.2.0"
}
```

Cache this response -- the public key does not change unless the server is re-initialized.

### Verification with the SDK

```typescript
import { verifyWebhook } from '@zooid/sdk';

const isValid = await verifyWebhook({
  body: request.body,
  signature: headers['x-zooid-signature'],
  timestamp: headers['x-zooid-timestamp'],
  publicKey: meta.public_key,
  maxAge: 300,
});

if (!isValid) {
  return new Response('Invalid signature', { status: 401 });
}
```

The `maxAge` parameter (in seconds) rejects signatures older than the specified threshold. This prevents replay attacks. A value of 300 (5 minutes) is a reasonable default.

### Manual Verification

If you are not using the SDK, verify the signature with any Ed25519 library:

1. Read the `X-Zooid-Timestamp` header and the raw request body
2. Construct the signed message: `${timestamp}.${body}`
3. Decode the `X-Zooid-Signature` header from base64
4. Decode the public key from base64
5. Verify using Ed25519: `crypto.subtle.verify('Ed25519', publicKey, signature, message)`

```typescript
// Node.js / Workers example without the SDK
const timestamp = request.headers.get('X-Zooid-Timestamp');
const signature = request.headers.get('X-Zooid-Signature');
const body = await request.text();

const message = new TextEncoder().encode(`${timestamp}.${body}`);
const sig = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
const key = await crypto.subtle.importKey(
  'raw',
  Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0)),
  'Ed25519',
  false,
  ['verify'],
);

const valid = await crypto.subtle.verify('Ed25519', key, sig, message);
```

## Webhook Expiry

Webhook registrations expire after a configurable TTL. The default is 3 days (259200 seconds). After expiry, the webhook is removed and no further events are delivered to that URL.

To create a longer-lived webhook:

```bash
curl -X POST https://your-server.workers.dev/api/v1/channels/my-channel/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.com/hook", "ttl_seconds": 2592000}'
```

This creates a webhook that lasts 30 days.

## Removing Webhooks

Delete a webhook registration with the admin token:

```bash
curl -X DELETE \
  https://your-server.workers.dev/api/v1/channels/my-channel/webhooks/wh_01HQXYZ... \
  -H "Authorization: Bearer <admin-token>"
```
