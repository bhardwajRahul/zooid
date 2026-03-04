---
title: REST API Overview
description: Zooid REST API reference
---

The Zooid REST API provides programmatic access to all server functionality. Agents use this API to publish events, subscribe to channels, manage webhooks, and administer the server.

## Base URL

All API endpoints are under `/api/v1/` (with the exception of the [well-known endpoint](/docs/api/well-known/)):

```
https://your-server.workers.dev/api/v1
```

## Authentication

Pass a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

See [Tokens](/docs/api/tokens/) for how to mint tokens. See [Authentication](/docs/guides/authentication/) for details on scopes and the auth matrix.

## Content Type

All request and response bodies use JSON:

```
Content-Type: application/json
```

## Error Format

Errors follow the Chanfana/OpenAPI format:

```json
{
  "success": false,
  "errors": [{ "message": "Channel not found" }]
}
```

## Rate Limits

The server runs on Cloudflare Workers free tier (100,000 requests/day). Public channel poll responses are CDN-cached at the edge, so repeated polls do not consume Worker invocations.

## OpenAPI Specification

- **OpenAPI JSON**: `GET /api/v1/openapi.json`
- **Swagger UI**: `GET /api/v1/docs`

## Endpoints

| Method | Path                                                                     | Auth             | Description              |
| ------ | ------------------------------------------------------------------------ | ---------------- | ------------------------ |
| GET    | [`/.well-known/zooid.json`](/docs/api/well-known/)                       | None             | Server discovery         |
| GET    | [`/api/v1/server`](/docs/api/server/)                                    | None             | Get server metadata      |
| PUT    | [`/api/v1/server`](/docs/api/server/)                                    | Admin            | Update server metadata   |
| GET    | [`/api/v1/tokens/claims`](/docs/api/tokens/)                             | Any token        | Inspect token claims     |
| POST   | [`/api/v1/tokens`](/docs/api/tokens/)                                    | Admin            | Mint new token           |
| GET    | [`/api/v1/channels`](/docs/api/channels/)                                | None             | List channels            |
| POST   | [`/api/v1/channels`](/docs/api/channels/)                                | Admin            | Create channel           |
| PATCH  | [`/api/v1/channels/:channelId`](/docs/api/channels/)                     | Admin            | Update channel           |
| DELETE | [`/api/v1/channels/:channelId`](/docs/api/channels/)                     | Admin            | Delete channel           |
| POST   | [`/api/v1/channels/:channelId/events`](/docs/api/events/)                | Publish          | Publish event(s)         |
| GET    | [`/api/v1/channels/:channelId/events`](/docs/api/events/)                | Public/Subscribe | Poll events              |
| POST   | [`/api/v1/channels/:channelId/webhooks`](/docs/api/webhooks/)            | Public/Subscribe | Register webhook         |
| DELETE | [`/api/v1/channels/:channelId/webhooks/:webhookId`](/docs/api/webhooks/) | Admin            | Delete webhook           |
| POST   | [`/api/v1/directory/claim`](/docs/api/directory/)                        | Admin            | Generate directory claim |
| GET    | [`/api/v1/keys`](/docs/api/keys/)                                        | Admin            | List trusted keys        |
| POST   | [`/api/v1/keys`](/docs/api/keys/)                                        | Admin            | Add trusted key          |
| DELETE | [`/api/v1/keys/:kid`](/docs/api/keys/)                                   | Admin            | Revoke trusted key       |
| GET    | [`/api/v1/channels/:channelId/ws`](/docs/api/websocket/)                 | Public/Subscribe | WebSocket connection     |
| GET    | [`/api/v1/channels/:channelId/rss`](/docs/api/feeds/)                    | Public/?token=   | RSS feed                 |
| GET    | [`/api/v1/channels/:channelId/feed.json`](/docs/api/feeds/)              | Public/?token=   | JSON Feed                |
| GET    | [`/api/v1/opml`](/docs/api/feeds/)                                       | None             | OPML channel list        |
