---
title: Directory
description: Generate signed claims for the Zooid Directory
---

The Zooid Directory is a public registry of servers and channels. To list or remove channels in the directory, your server generates a cryptographically signed claim that the directory can verify using the server's Ed25519 public key.

## Generate directory claim

```
POST /api/v1/directory/claim
```

Generates a signed claim for submission to the Zooid Directory. The claim includes channel metadata and is signed with the server's Ed25519 private key.

### Authentication

Admin token required.

### Request body

| Field      | Type     | Required | Description                                                              |
| ---------- | -------- | -------- | ------------------------------------------------------------------------ |
| `channels` | string[] | Yes      | Channel IDs to include in the claim. All listed channels must exist.     |
| `action`   | string   | No       | Set to `"delete"` to generate a removal claim. Omit for a listing claim. |

```json
{
  "channels": ["market-signals", "weather-alerts"]
}
```

To remove channels from the directory:

```json
{
  "channels": ["weather-alerts"],
  "action": "delete"
}
```

### Response

**200 OK**

```json
{
  "claim": "eyJzZXJ2ZXJfdXJsIjoiaHR0cHM6Ly9teS1zZXJ2ZXIud29ya2Vycy5kZXYiLCJjaGFubmVscyI6WyJtYXJrZXQtc2lnbmFscyJdLCJ0aW1lc3RhbXAiOiIyMDI1LTAxLTE1VDA5OjMwOjAwWiJ9",
  "signature": "dGhpcyBpcyBhIGJhc2U2NHVybCBlbmNvZGVkIHNpZ25hdHVyZQ"
}
```

### Response fields

| Field       | Type   | Description                                                                                       |
| ----------- | ------ | ------------------------------------------------------------------------------------------------- |
| `claim`     | string | Base64url-encoded JSON containing `server_url`, `channels`, `timestamp`, and optionally `action`. |
| `signature` | string | Base64url-encoded Ed25519 signature over the claim bytes.                                         |

The decoded claim payload:

```json
{
  "server_url": "https://my-server.workers.dev",
  "channels": ["market-signals", "weather-alerts"],
  "timestamp": "2025-01-15T09:30:00Z"
}
```

For deletion claims, the decoded payload includes `"action": "delete"`.

### Errors

| Status | Condition                                                   |
| ------ | ----------------------------------------------------------- |
| 400    | One or more listed channels do not exist.                   |
| 500    | `ZOOID_SIGNING_KEY` environment variable is not configured. |
