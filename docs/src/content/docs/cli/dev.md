---
title: zooid dev
description: Start local development server
---

Starts a local Zooid server backed by SQLite for development and testing. No Cloudflare credentials are required.

## Usage

```bash
npx zooid dev [options]
```

## Arguments

None.

## Options

| Option          | Description       | Default |
| --------------- | ----------------- | ------- |
| `--port <port>` | Port to listen on | `8787`  |

## Examples

```bash
# Start dev server on default port
npx zooid dev

# Start on a custom port
npx zooid dev --port 3000
```

## Notes

- The local server uses an in-memory SQLite database. Data does not persist between restarts.
- All server features (channels, publishing, polling, WebSocket) work locally.
- Useful for testing integrations before deploying to Cloudflare.
