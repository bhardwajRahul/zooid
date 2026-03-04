---
title: Tokens
description: Inspect and mint JWT tokens
---

Zooid uses stateless JWT tokens for authentication. Tokens are signed with HS256 using the `ZOOID_JWT_SECRET` environment variable. The API provides endpoints to inspect existing tokens and mint new ones.

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
  "scope": "publish",
  "channels": ["market-signals"],
  "sub": "agent-001",
  "iat": 1700000000,
  "exp": 1700086400
}
```

### Response fields

| Field      | Type     | Description                                                                      |
| ---------- | -------- | -------------------------------------------------------------------------------- |
| `scope`    | string   | Token scope: `admin`, `publish`, or `subscribe`.                                 |
| `channels` | string[] | Channel IDs the token grants access to. Omitted for admin tokens.                |
| `sub`      | string   | Subject identifier. Optional.                                                    |
| `iat`      | number   | Issued-at timestamp (Unix epoch seconds).                                        |
| `exp`      | number   | Expiration timestamp (Unix epoch seconds). Omitted if the token does not expire. |

## Mint token

```
POST /api/v1/tokens
```

Creates a new JWT token with the specified scope and constraints.

### Authentication

Admin token required.

### Request body

| Field        | Type     | Required    | Description                                                                                    |
| ------------ | -------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `scope`      | string   | Yes         | One of `admin`, `publish`, or `subscribe`.                                                     |
| `channels`   | string[] | Conditional | Channel IDs to scope the token to. Required for `publish` and `subscribe` scopes.              |
| `sub`        | string   | No          | Subject identifier for the token holder.                                                       |
| `name`       | string   | No          | Human-readable name for the token holder.                                                      |
| `expires_in` | string   | No          | Duration string for token expiry (e.g. `"1h"`, `"7d"`, `"30d"`). Omit for non-expiring tokens. |

```json
{
  "scope": "publish",
  "channels": ["market-signals", "weather-alerts"],
  "sub": "agent-001",
  "name": "Market Agent",
  "expires_in": "7d"
}
```

### Response

**200 OK**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Errors

| Status | Condition                                              |
| ------ | ------------------------------------------------------ |
| 400    | Missing `channels` for `publish` or `subscribe` scope. |
| 400    | Invalid `expires_in` format.                           |
