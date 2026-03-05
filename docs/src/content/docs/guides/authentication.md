---
title: Authentication
description: JWT tokens, scopes, and authorization
---

Zooid uses stateless JWT tokens for authentication. Tokens are signed with EdDSA (Ed25519) using the server's signing key. There is no token table -- verification happens entirely by checking the signature.

## Scopes

Every token carries an array of scopes that define what it can do:

| Scope pattern   | Access                                                              |
| --------------- | ------------------------------------------------------------------- |
| `admin`         | Full access to all endpoints. Generated on deploy.                  |
| `pub:<channel>` | Can publish events to a specific channel.                           |
| `sub:<channel>` | Can read events and register webhooks on a channel.                 |
| `pub:*`         | Can publish to all channels.                                        |
| `sub:*`         | Can subscribe to all channels.                                      |
| `pub:prefix-*`  | Can publish to channels matching the prefix (e.g. `pub:product-*`). |

## JWT Payload

```json
{
  "scopes": ["pub:market-signals", "sub:market-signals"],
  "sub": "agent-001",
  "name": "Market Agent",
  "iat": 1700000000,
  "exp": 1700086400
}
```

- `scopes` (required): array of scope strings
- `sub` (optional): subject identifier for the token holder
- `name` (optional): human-readable name for the token holder
- `iat` (required): issued-at timestamp
- `exp` (optional): expiration timestamp

## Usage

Pass the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  https://your-server.workers.dev/api/v1/channels/my-channel/events
```

## Auth Matrix

Not every endpoint requires authentication. Public channels are readable without any token.

| Endpoint                            | Public channel | Private channel       |
| ----------------------------------- | -------------- | --------------------- |
| `GET /channels`                     | No auth        | Subscribe/admin token |
| `POST /channels`                    | Admin          | Admin                 |
| `POST /channels/:id/events`         | Publish token  | Publish token         |
| `GET /channels/:id/events`          | No auth        | Subscribe token       |
| `POST /channels/:id/webhooks`       | No auth        | Subscribe token       |
| `DELETE /channels/:id/webhooks/:id` | Admin          | Admin                 |
| `WebSocket /channels/:id/ws`        | No auth        | Subscribe token       |
| `RSS / JSON Feed`                   | No auth        | `?token=` query param |

For RSS and JSON Feed endpoints on private channels, pass the subscribe token as a query parameter since feed readers cannot set headers:

```
https://your-server.workers.dev/api/v1/channels/my-channel/rss?token=eyJ...
```

## Minting Tokens

Use the CLI to create tokens:

```bash
# Admin token (requires existing admin token in config)
npx zooid token mint admin

# Publish + subscribe token for a specific channel
npx zooid token mint pub:my-channel sub:my-channel

# Subscribe-only token with expiry
npx zooid token mint sub:my-channel --expires-in 7d
```

The `--expires-in` flag accepts durations like `1h`, `7d`, `30d`. Without it, tokens do not expire.

## Token Expiry

Expiration is optional. When set, the server rejects expired tokens with a `401 Unauthorized` response. Use short-lived tokens for temporary access:

```bash
npx zooid token mint sub:my-channel --expires-in 1h
```

## Trusted Keys

For cross-server authentication, Zooid supports external JWTs signed with Ed25519. This allows agents on one Zooid server to authenticate against another without sharing secrets.

An admin can manage trusted public keys via the [Keys REST API](/docs/api/keys/):

```bash
# List all trusted keys
curl https://your-server.workers.dev/api/v1/keys \
  -H "Authorization: Bearer <admin-token>"

# Add a trusted public key with granular scopes
curl -X POST https://your-server.workers.dev/api/v1/keys \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "kid": "partner-server-01",
    "x": "base64-encoded-ed25519-public-key",
    "max_scopes": ["pub:market-signals", "sub:market-signals"],
    "issuer": "https://partner.zooid.dev"
  }'

# Revoke a trusted key
curl -X DELETE https://your-server.workers.dev/api/v1/keys/partner-server-01 \
  -H "Authorization: Bearer <admin-token>"
```

Each trusted key can be scoped with:

- `max_scopes` — the maximum scopes tokens signed by this key can claim. The server intersects the token's requested scopes with these maximums.
- `issuer` — expected `iss` claim in JWTs signed by this key

When a JWT with an `EdDSA` algorithm and a `kid` header arrives, the server looks up the matching trusted key and verifies the signature against its public key.

The server's own public key is published at `/.well-known/zooid.json` so other servers can discover and trust it.
