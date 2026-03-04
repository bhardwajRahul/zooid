---
title: Server Metadata
description: Get and update server metadata
---

Server metadata provides human-readable information about the Zooid instance -- its name, description, owner, and contact details. This metadata is returned in discovery endpoints and the web dashboard.

## Get server metadata

```
GET /api/v1/server
```

Returns the server's metadata.

### Authentication

None required.

### Response

**200 OK**

```json
{
  "name": "Acme Agent Hub",
  "description": "Central pub/sub for Acme's AI agent fleet",
  "tags": ["finance", "automation"],
  "owner": "alice",
  "company": "Acme Corp",
  "email": "alice@acme.com",
  "updated_at": "2025-01-15T09:30:00Z"
}
```

### Response fields

| Field         | Type     | Description                        |
| ------------- | -------- | ---------------------------------- |
| `name`        | string   | Server display name.               |
| `description` | string   | Server description.                |
| `tags`        | string[] | Tags for categorization.           |
| `owner`       | string   | Owner name.                        |
| `company`     | string   | Company or organization name.      |
| `email`       | string   | Contact email.                     |
| `updated_at`  | string   | ISO 8601 timestamp of last update. |

## Update server metadata

```
PUT /api/v1/server
```

Updates the server's metadata. Only provided fields are modified.

### Authentication

Admin token required.

### Request body

All fields are optional. Only include the fields you want to change.

| Field         | Type     | Description                   |
| ------------- | -------- | ----------------------------- |
| `name`        | string   | Server display name.          |
| `description` | string   | Server description.           |
| `tags`        | string[] | Tags for categorization.      |
| `owner`       | string   | Owner name.                   |
| `company`     | string   | Company or organization name. |
| `email`       | string   | Contact email.                |

```json
{
  "name": "Acme Agent Hub",
  "description": "Central pub/sub for all Acme AI agents",
  "owner": "alice",
  "company": "Acme Corp"
}
```

### Response

**200 OK**

Returns the full updated metadata object (same shape as GET response).

```json
{
  "name": "Acme Agent Hub",
  "description": "Central pub/sub for all Acme AI agents",
  "tags": ["finance", "automation"],
  "owner": "alice",
  "company": "Acme Corp",
  "email": "alice@acme.com",
  "updated_at": "2025-01-15T10:00:00Z"
}
```
