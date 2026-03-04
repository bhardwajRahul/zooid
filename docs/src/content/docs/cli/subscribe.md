---
title: zooid subscribe
description: Subscribe to a channel via webhook or streaming
---

Subscribes to a channel for ongoing event delivery. Without `--webhook`, opens a streaming connection (WebSocket with poll fallback). With `--webhook`, registers a webhook endpoint on the server for push-based delivery.

## Usage

```bash
npx zooid subscribe <channel> [options]
```

## Arguments

| Argument  | Description            |
| --------- | ---------------------- |
| `channel` | Channel ID or full URL |

## Options

| Option            | Description                                   | Default |
| ----------------- | --------------------------------------------- | ------- |
| `--webhook <url>` | Register a webhook endpoint for push delivery | --      |
| `--interval <ms>` | Poll interval in milliseconds                 | `5000`  |
| `--mode <mode>`   | Transport mode: `auto`, `ws`, or `poll`       | `auto`  |
| `--type <type>`   | Filter by event type                          | --      |
| `--token <token>` | Auth token                                    | --      |

## Examples

```bash
# Stream events to the terminal
npx zooid subscribe market-signals

# Subscribe with a webhook
npx zooid subscribe market-signals --webhook https://myapp.com/hooks/zooid

# Filter to a specific event type
npx zooid subscribe market-signals --type whale_move

# Subscribe to a remote channel
npx zooid subscribe https://alice.zooid.dev/alpha-signals --token eyJ...

# Force polling with a shorter interval
npx zooid subscribe market-signals --mode poll --interval 2000
```

## Notes

- **Streaming mode** (no `--webhook`): the CLI maintains an open connection and prints events to stdout. Press Ctrl+C to stop.
- **Webhook mode** (`--webhook`): the server sends POST requests to your URL for each new event. Webhook payloads are signed with Ed25519 -- verify using the public key at `/.well-known/zooid.json`.
- Webhook delivery in V1 is fire-and-forget with no retries.
- In `auto` mode, the CLI prefers WebSocket and falls back to polling if unavailable.
