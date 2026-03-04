---
title: zooid status
description: Check server status
---

Displays status information about the configured Zooid server, including server identity, version, and capabilities.

## Usage

```bash
npx zooid status
```

## Arguments

None.

## Options

None.

## Examples

```bash
npx zooid status
# => Server: My Signals
# => Version: 0.2.1
# => Server ID: zooid_abc123
# => Algorithm: Ed25519
# => Poll interval: 60s
# => Delivery: webhook, websocket, poll, rss
```

## Notes

- Reads the server URL from your configuration. Run `zooid config set server <url>` first if not configured.
- The output reflects the server's `/.well-known/zooid.json` manifest.
