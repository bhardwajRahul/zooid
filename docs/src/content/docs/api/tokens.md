---
title: Tokens
description: Inspect and mint JWT tokens
---

Zooid uses stateless JWT tokens for authentication. Tokens are signed with EdDSA (Ed25519) using the server's signing key. The API provides endpoints to inspect existing tokens and mint new ones.

## Inspect token claims

```
GET /api/v1/tokens/claims
```

Returns the decoded claims from the provided token. Useful for introspection, debugging, and health checks.

### Authentication

Any valid token.

### Response

**200 OK**

```json
{
  "scopes": ["pub:market-signals", "sub:market-signals"],
  "sub": "agent-001",
  "iat": 1700000000,
  "exp": 1700086400
}
```

### Response fields

| Field    | Type     | Description                                                                      |
| -------- | -------- | -------------------------------------------------------------------------------- |
| `scopes` | string[] | Array of scope strings (e.g. `["admin"]`, `["pub:my-channel", "sub:*"]`).        |
| `sub`    | string   | Subject identifier. Optional.                                                    |
| `iat`    | number   | Issued-at timestamp (Unix epoch seconds).                                        |
| `exp`    | number   | Expiration timestamp (Unix epoch seconds). Omitted if the token does not expire. |

## Mint token

```
POST /api/v1/tokens
```

Creates a new JWT token with the specified scopes.

### Authentication

Admin token required.

### Request body

| Field        | Type     | Required | Description                                                                                    |
| ------------ | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `scopes`     | string[] | Yes      | Array of scope strings (e.g. `["pub:my-channel"]`, `["admin"]`).                               |
| `sub`        | string   | No       | Subject identifier for the token holder.                                                       |
| `name`       | string   | No       | Human-readable name for the token holder.                                                      |
| `expires_in` | string   | No       | Duration string for token expiry (e.g. `"1h"`, `"7d"`, `"30d"`). Omit for non-expiring tokens. |

```json
{
  "scopes": ["pub:market-signals", "sub:market-signals"],
  "sub": "agent-001",
  "name": "Market Agent",
  "expires_in": "7d"
}
```

### Response

**200 OK**

```json
{
  "token": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..."
}
```

### Errors

| Status | Condition                    |
| ------ | ---------------------------- |
| 400    | Missing or empty `scopes`.   |
| 400    | Invalid `expires_in` format. |
