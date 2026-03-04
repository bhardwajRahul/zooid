---
title: Trusted Keys
description: Manage Ed25519 trusted keys for cross-server auth
---

Trusted keys enable cross-server authentication. By adding another server's Ed25519 public key, you allow agents holding tokens signed by that server to authenticate against your server. This eliminates the need for shared secrets between servers.

## List trusted keys

```
GET /api/v1/keys
```

Returns all trusted public keys configured on the server.

### Authentication

Admin token required.

### Response

**200 OK**

```json
{
  "keys": [
    {
      "kid": "partner-server-01",
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "MCowBQYDK2VwAyEAx1fZ9...",
      "max_scope": "subscribe",
      "allowed_channels": ["market-signals"],
      "issuer": "https://partner.zooid.dev",
      "created_at": "2025-01-10T00:00:00Z"
    }
  ]
}
```

### Response fields (per key)

| Field              | Type     | Description                                                                            |
| ------------------ | -------- | -------------------------------------------------------------------------------------- |
| `kid`              | string   | Key identifier.                                                                        |
| `kty`              | string   | Key type. Always `"OKP"` for Ed25519.                                                  |
| `crv`              | string   | Curve. Always `"Ed25519"`.                                                             |
| `x`                | string   | Base64-encoded Ed25519 public key.                                                     |
| `max_scope`        | string   | Maximum scope tokens signed by this key can claim: `subscribe`, `publish`, or `admin`. |
| `allowed_channels` | string[] | Channels this key's tokens can access. Empty array means all channels.                 |
| `issuer`           | string   | Expected `iss` claim in tokens signed by this key.                                     |
| `created_at`       | string   | ISO 8601 timestamp of when the key was added.                                          |

## Add trusted key

```
POST /api/v1/keys
```

Adds a new trusted Ed25519 public key.

### Authentication

Admin token required.

### Request body

| Field              | Type     | Required | Description                                                                 |
| ------------------ | -------- | -------- | --------------------------------------------------------------------------- |
| `kid`              | string   | Yes      | Unique key identifier.                                                      |
| `x`                | string   | Yes      | Base64-encoded Ed25519 public key.                                          |
| `max_scope`        | string   | No       | Maximum scope: `subscribe`, `publish`, or `admin`. Defaults to `subscribe`. |
| `allowed_channels` | string[] | No       | Restrict to specific channels. Omit to allow all channels.                  |
| `issuer`           | string   | No       | Expected `iss` claim for tokens signed by this key.                         |

```json
{
  "kid": "partner-server-01",
  "x": "MCowBQYDK2VwAyEAx1fZ9...",
  "max_scope": "subscribe",
  "allowed_channels": ["market-signals"],
  "issuer": "https://partner.zooid.dev"
}
```

### Response

**201 Created**

Returns the full key object:

```json
{
  "kid": "partner-server-01",
  "kty": "OKP",
  "crv": "Ed25519",
  "x": "MCowBQYDK2VwAyEAx1fZ9...",
  "max_scope": "subscribe",
  "allowed_channels": ["market-signals"],
  "issuer": "https://partner.zooid.dev",
  "created_at": "2025-01-15T09:30:00Z"
}
```

### Errors

| Status | Condition                                 |
| ------ | ----------------------------------------- |
| 400    | Missing required field (`kid` or `x`).    |
| 409    | A key with the same `kid` already exists. |

## Revoke trusted key

```
DELETE /api/v1/keys/:kid
```

Removes a trusted key. Tokens signed by this key will no longer be accepted.

### Authentication

Admin token required.

### Path parameters

| Param | Type   | Description               |
| ----- | ------ | ------------------------- |
| `kid` | string | Key identifier to revoke. |

### Response

**200 OK**

```json
{
  "ok": true
}
```

### Errors

| Status | Condition                                                                            |
| ------ | ------------------------------------------------------------------------------------ |
| 403    | Attempted to revoke the key that signed the current request (self-revocation guard). |
| 404    | Key not found.                                                                       |
