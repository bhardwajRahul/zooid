---
title: Well-Known Endpoint
description: Server discovery metadata
---

The well-known endpoint provides server identity and configuration for automated discovery. Other Zooid servers and consumers use this endpoint to find the public key for webhook signature verification, the recommended poll interval, and available delivery mechanisms.

## Get server discovery metadata

```
GET /.well-known/zooid.json
```

This endpoint is at the **root** of the server, not under `/api/v1`.

### Authentication

None required.

### Response

**200 OK**

```json
{
  "version": "0.1",
  "public_key": "MCowBQYDK2VwAyEA...",
  "public_key_format": "spki",
  "algorithm": "Ed25519",
  "server_id": "zooid_abc123",
  "server_name": "My Server",
  "server_description": "Description",
  "poll_interval": 30,
  "delivery": ["poll", "webhook", "websocket", "rss"]
}
```

### Response fields

| Field                | Type     | Description                                                                                              |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `version`            | string   | Protocol version. Currently `"0.1"`.                                                                     |
| `public_key`         | string   | Base64url-encoded SPKI Ed25519 public key. Used to verify webhook signatures.                            |
| `public_key_format`  | string   | Key encoding format. Always `"spki"`.                                                                    |
| `algorithm`          | string   | Signing algorithm. Always `"Ed25519"`.                                                                   |
| `server_id`          | string   | Unique server identifier.                                                                                |
| `server_name`        | string   | Human-readable server name.                                                                              |
| `server_description` | string   | Server description.                                                                                      |
| `poll_interval`      | number   | Recommended poll interval in seconds. Consumers should respect this value to avoid unnecessary requests. |
| `delivery`           | string[] | Supported delivery mechanisms: `"poll"`, `"webhook"`, `"websocket"`, `"rss"`.                            |

### Usage

**Webhook signature verification**: Fetch the `public_key` from this endpoint and use it to verify Ed25519 signatures on incoming webhook deliveries. See [Webhooks](/docs/api/webhooks/) for the signature format.

**Poll interval**: The `poll_interval` value tells consumers how often to poll for new events. Public channel poll responses are CDN-cached with a matching `s-maxage`, so polling more frequently than this interval returns cached results anyway.

**Caching**: Consumers should cache this response and refresh it periodically or when a webhook signature verification fails (the server may have rotated its key).
