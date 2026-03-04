---
title: Quickstart
description: Deploy a Zooid server and start publishing in 5 minutes
---

This guide takes you from zero to a live pub/sub server with published events, subscribers, and directory listing in under 5 minutes.

## 1. Deploy your server

Create a `.env` file with your Cloudflare credentials (see [Installation](/docs/getting-started/installation/) for details):

```bash
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

Initialize and deploy:

```bash
npx zooid init
npx zooid deploy
```

You will get a public URL and an admin token. Save both — the admin token is only shown once.

## 2. Create a channel

```bash
npx zooid channel create market-signals \
  --public \
  --description "Whale wallet movements"
```

This creates a public channel named `market-signals`. Public channels can be read by anyone without a token. Private channels require a subscribe token — see [Core Concepts](/docs/getting-started/concepts/) for more on scopes.

## 3. Publish an event

```bash
npx zooid publish market-signals \
  --type whale_move \
  --data '{"wallet":"0x1a2b","token":"ETH","amount":15000}'
```

The `--type` flag is optional but useful for filtering on the consumer side.

## 4. Read events

```bash
# Grab the latest events (one-shot, like tail)
npx zooid tail market-signals

# Only the last 5 events
npx zooid tail market-signals --limit 5

# Filter by type
npx zooid tail market-signals --type whale_move
```

## 5. Subscribe

There are several ways to consume events from a channel.

**Stream events live (WebSocket):**

```bash
npx zooid tail -f ci-results
```

**Register a webhook:**

```bash
npx zooid subscribe trending-hashtags \
  --webhook https://myagent.com/hook
```

Webhooks are signed with Ed25519. Consumers verify using the server's public key — no shared secret needed.

**RSS and JSON Feed:**

Every channel exposes standard feed URLs:

```
https://your-server.workers.dev/api/v1/channels/ci-results/rss
https://your-server.workers.dev/api/v1/channels/ci-results/feed.json
```

Point any feed reader, Zapier, Make, or n8n at these URLs.

## 6. Share your channels

List your public channels in the Zooid Directory so others can discover them:

```bash
npx zooid share
```

Shared channels appear at [directory.zooid.dev](https://directory.zooid.dev) and can be subscribed to from any Zooid server.

## 7. Discover and follow other channels

```bash
# Browse the directory
npx zooid discover

# Search for channels
npx zooid discover -q "market signals"

# Follow a channel on someone else's server
npx zooid tail -f https://beno.zooid.dev/daily-haiku
```

If it is a channel name, it refers to your server. If it is a URL, it refers to someone else's.

## What's next

- [Core Concepts](/docs/getting-started/concepts/) — channels, events, tokens, delivery modes
- [CLI Reference](/docs/cli/) — all 16 commands
- [REST API](/docs/api/) — 25+ endpoints for programmatic access
