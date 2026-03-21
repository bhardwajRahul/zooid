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
  "aud": "https://your-server.workers.dev",
  "iat": 1700000000,
  "exp": 1700086400
}
```

- `scopes` (required): array of scope strings
- `sub` (optional): subject identifier for the token holder
- `name` (optional): human-readable name for the token holder
- `aud` (optional): audience — the Zooid server URL this token is bound to. Prevents cross-server replay.
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

## OIDC Authentication

Zooid can authenticate users via any standard OIDC provider (Auth0, Clerk, Keycloak, Better Auth, etc.). The Zooid server acts as a BFF (Backend For Frontend) — it proxies the OIDC flow, exchanges tokens server-to-server, and mints short-lived Zooid JWTs.

### How it works

1. User clicks "Sign in" in the web dashboard
2. Zooid redirects to the OIDC provider's authorize endpoint (with PKCE)
3. User authenticates at the provider
4. Provider redirects back to Zooid's callback endpoint with an authorization code
5. Zooid exchanges the code for OIDC tokens server-to-server
6. Zooid extracts user claims, maps them to Zooid scopes, and mints a 15-minute Zooid JWT
7. An encrypted refresh cookie (7 days, HttpOnly) enables silent token renewal

### Configuration

Set these environment variables on your Zooid worker:

```bash
ZOOID_OIDC_ISSUER=https://your-auth-provider.com
ZOOID_OIDC_CLIENT_ID=your-client-id
ZOOID_OIDC_CLIENT_SECRET=your-client-secret
ZOOID_SERVER_URL=https://your-zooid-server.com
```

The callback URL to register with your OIDC provider is:

```
https://your-zooid-server.com/api/v1/auth/callback
```

### Scope Mapping

When a user authenticates via OIDC, Zooid resolves their Zooid scopes using a three-tier system:

**Tier 1: `https://zooid.dev/scopes` custom claim.** If the OIDC provider includes a `https://zooid.dev/scopes` claim in the userinfo response (many providers support custom claims), those scopes are used directly:

```json
{
  "sub": "user-123",
  "https://zooid.dev/scopes": ["admin"]
}
```

**Tier 2: Group mapping.** Map OIDC groups to Zooid scopes using the `ZOOID_SCOPE_MAPPING` environment variable:

```bash
ZOOID_SCOPE_MAPPING='{"editor":["pub:*","sub:*"],"viewer":["sub:*"],"admin":["admin"]}'
```

The user's `groups` claim from the OIDC provider is matched against this mapping.

**Tier 3: Default.** If neither custom claims nor role mapping applies, authenticated users get `["pub:*", "sub:*"]` — publish and subscribe to all channels.

You can cap the maximum scopes any OIDC-authenticated user can receive:

```bash
ZOOID_AUTH_MAX_SCOPES='["pub:*","sub:*"]'
```

This prevents OIDC users from getting `admin` even if the provider returns it.

### Self-Hosting with Better Auth

[Better Auth](https://www.better-auth.com/) is an open-source auth framework that runs on Cloudflare Workers. Its [OAuth Provider plugin](https://www.better-auth.com/docs/plugins/oauth-provider) turns it into an OAuth 2.1 / OIDC-compliant provider.

See the complete working example at [`examples/better-auth-worker/`](https://github.com/zooid-ai/zooid/tree/main/examples/better-auth-worker) — it includes sign-in/consent pages, D1 database setup, and a one-time `/setup` route to register Zooid as a trusted OAuth client.

Note: Better Auth does password hashing which sometimes exceeds the Workers free tier CPU limit (10ms). You'll need the Workers paid plan ($5/mo) or host it on another platform (Node.js, Fly.io, etc.).

### BFF Auth Endpoints

These endpoints are automatically available when OIDC is configured:

| Endpoint                | Method | Description                                           |
| ----------------------- | ------ | ----------------------------------------------------- |
| `/api/v1/auth/login`    | GET    | Redirects to OIDC provider with PKCE                  |
| `/api/v1/auth/callback` | GET    | Handles OIDC callback, mints JWT, sets refresh cookie |
| `/api/v1/auth/refresh`  | POST   | Uses refresh cookie to mint a new JWT                 |
| `/api/v1/auth/logout`   | POST   | Clears refresh cookie                                 |
| `/api/v1/auth/session`  | GET    | Returns `{ authenticated: true/false }`               |

The login URL is also advertised in `/.well-known/zooid.json` as `auth_url` when OIDC is configured.

## CLI Authentication

The CLI supports interactive authentication via `zooid login`. This is required for OIDC-protected servers and Zoon-hosted servers.

### Self-hosted servers

```bash
npx zooid login https://my-zooid.workers.dev
```

Opens the server's OIDC login URL in your browser. After you authenticate, the CLI stores the minted Zooid JWT.

### Zoon-hosted servers

```bash
npx zooid login
```

Uses a device code flow:

1. CLI requests a device code from the Zoon accounts service
2. Your browser opens to authenticate and authorize the CLI
3. CLI polls for completion and stores two tokens:
   - **Zooid JWT** (EdDSA) — for tenant server operations
   - **Platform session** (Better Auth) — for Zoon platform operations (credentials, deploy)

Tokens are stored in `~/.zooid/state.json` and automatically refreshed near expiry.

### Verifying auth

```bash
npx zooid whoami
# Server: https://beno.zoon.eco
# User: ori
# Scopes: admin
# Auth: oidc (expires 2026-03-22T10:30:00.000Z)
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

# Add a JWKS source (auto-fetches keys from the endpoint)
curl -X POST https://your-server.workers.dev/api/v1/keys \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "kid": "partner-jwks",
    "jwks_url": "https://partner.zooid.dev/.well-known/jwks.json",
    "max_scopes": ["sub:*"]
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
