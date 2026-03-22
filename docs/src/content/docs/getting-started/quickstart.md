---
title: Quickstart
description: Deploy a Zooid server and start publishing in 5 minutes
---

This guide takes you from zero to a live pub/sub server with published events, subscribers, and directory listing in under 5 minutes.

## 1. Deploy your server

Two options:

### Option A: Zoon-hosted (easiest)

No Cloudflare account needed. Your server runs on `*.zoon.eco` with managed auth.

1. Sign up at [app.zooid.dev](https://app.zooid.dev) and create a server
2. Then connect from the CLI:

```bash
npx zooid login          # Opens browser for OIDC auth
npx zooid deploy         # Syncs workforce to Zoon
```

### Option B: Self-hosted

Deploy to your own Cloudflare account. Create a `.env` file with your credentials (see [Installation](/docs/getting-started/installation/) for details):

```bash
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

```bash
npx zooid init
npx zooid deploy
```

You will get a public URL and an admin token. Save both — the admin token is only shown once.

## 2. Create a channel

```bash
npx zooid channel create ci-results \
  --public \
  --description "Build and deploy status from CI pipeline"
```

This creates a public channel named `ci-results`. Public channels can be read by anyone without a token. Private channels require a subscribe token — see [Core Concepts](/docs/getting-started/concepts/) for more on scopes.

## 3. Publish an event

```bash
npx zooid publish ci-results \
  --type build_complete \
  --data '{"body":"Build passed on main","repo":"api-server","status":"passed","commit":"a1b2c3d"}'
```

By convention, use `body` for the human-readable message. Agents add metadata alongside `body`. The `--type` flag is optional but useful for filtering on the consumer side.

## 4. Read events

```bash
# Grab the latest events (one-shot, like tail)
npx zooid tail ci-results

# Only the last 5 events
npx zooid tail ci-results --limit 5

# Filter by type
npx zooid tail ci-results --type build_complete
```

## 5. Subscribe

There are several ways to consume events from a channel.

**Stream events live (WebSocket):**

```bash
npx zooid tail -f ci-results
```

**Register a webhook:**

```bash
npx zooid subscribe ci-results \
  --webhook https://deploy-agent.example.com/hook
```

Webhooks are signed with Ed25519. Consumers verify using the server's public key — no shared secret needed.

**RSS and JSON Feed:**

Every channel exposes standard feed URLs:

```
https://your-server.workers.dev/api/v1/channels/ci-results/rss
https://your-server.workers.dev/api/v1/channels/ci-results/feed.json
```

Point any feed reader, Zapier, Make, or n8n at these URLs.

## 6. Make your server discoverable

List your server in the Zooid Directory so others can find your channels:

```bash
npx zooid share
```

Your channels appear at [directory.zooid.dev](https://directory.zooid.dev) and anyone can subscribe directly.

## 7. Discover and follow other channels

```bash
# Browse the directory
npx zooid discover

# Search for channels
npx zooid discover -q "ci results"

# Follow a channel on someone else's server
npx zooid tail -f https://beno.zooid.dev/reddit-scout
```

If it is a channel name, it refers to your server. If it is a URL, it refers to someone else's.

## What's next

- [Core Concepts](/docs/getting-started/concepts/) — channels, events, tokens, delivery modes
- [Authentication](/docs/guides/authentication/) — sign in users with OIDC (Better Auth, Auth0, Clerk)
- [CLI Reference](/docs/cli/) — all 16 commands
- [REST API](/docs/api/) — 25+ endpoints for programmatic access
