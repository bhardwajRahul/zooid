---
title: Channels
description: Create, list, update, and delete channels
---

Channels are named topics that events are published to and consumed from. Channel IDs are URL-safe slugs: lowercase alphanumeric characters and hyphens, 3-64 characters long.

## List channels

```
GET /api/v1/channels
```

Returns channels visible to the caller. Without auth, only public channels are returned. With a token, private channels matching the token's scopes are also included. Admin tokens see all channels.

### Response

**200 OK**

```json
{
  "channels": [
    {
      "id": "market-signals",
      "name": "Market Signals",
      "description": "Real-time trading signals",
      "tags": ["finance", "trading"],
      "is_public": true,
      "event_count": 1420,
      "last_event_at": "2025-01-15T09:30:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

## Create channel

```
POST /api/v1/channels
```

Creates a new channel and returns a scoped token for publishing and subscribing.

### Authentication

Admin token required.

### Request body

| Field         | Type     | Required | Description                                                                                                                |
| ------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string   | Yes      | Channel ID. 3-64 chars, lowercase alphanumeric + hyphens.                                                                  |
| `name`        | string   | Yes      | Human-readable display name.                                                                                               |
| `description` | string   | No       | Channel description.                                                                                                       |
| `tags`        | string[] | No       | Tags for categorization.                                                                                                   |
| `is_public`   | boolean  | No       | Whether the channel is publicly readable. Defaults to `true`.                                                              |
| `config`      | object   | No       | Channel configuration. Set `config.strict_types: true` to enforce schema validation, and define schemas in `config.types`. |

### Response

**201 Created**

```json
{
  "id": "market-signals",
  "token": "eyJhbGciOiJFZERTQSIs..."
}
```

### Errors

| Status | Condition                                           |
| ------ | --------------------------------------------------- |
| 400    | Invalid channel ID format.                          |
| 400    | `config.strict_types: true` without `config.types`. |
| 409    | Channel with this ID already exists.                |

## Update channel

```
PATCH /api/v1/channels/:channelId
```

Updates an existing channel. Only provided fields are modified.

### Authentication

Admin token required.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |

### Request body

All fields are optional. Only include the fields you want to change.

| Field         | Type     | Description                                                          |
| ------------- | -------- | -------------------------------------------------------------------- |
| `name`        | string   | Display name.                                                        |
| `description` | string   | Channel description.                                                 |
| `tags`        | string[] | Tags for categorization.                                             |
| `is_public`   | boolean  | Public visibility.                                                   |
| `config`      | object   | Channel configuration (includes `strict_types`, `types`, `storage`). |

### Response

**200 OK**

```json
{
  "id": "market-signals",
  "name": "Market Signals (Updated)",
  "description": "Real-time trading signals from multiple sources",
  "tags": ["finance", "trading", "crypto"],
  "is_public": true,
  "config": null
}
```

### Errors

| Status | Condition          |
| ------ | ------------------ |
| 404    | Channel not found. |

## Delete channel

```
DELETE /api/v1/channels/:channelId
```

Permanently deletes a channel and all its events, webhooks, and subscriptions.

### Authentication

Admin token required.

### Path parameters

| Param       | Type   | Description |
| ----------- | ------ | ----------- |
| `channelId` | string | Channel ID. |

### Response

**204 No Content**

No response body.

### Errors

| Status | Condition          |
| ------ | ------------------ |
| 404    | Channel not found. |
