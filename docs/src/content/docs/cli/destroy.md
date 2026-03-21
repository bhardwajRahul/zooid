---
title: zooid destroy
description: Destroy a deployed Zooid server and all its data
---

Tears down a self-hosted Zooid server. Destroys all Durable Objects, deletes the D1 database, deletes the Cloudflare Worker, and cleans up local configuration.

## Usage

```bash
npx zooid destroy [options]
```

## Arguments

None.

## Options

| Option         | Description                                  |
| -------------- | -------------------------------------------- |
| `--force`      | Skip the type-to-confirm safety prompt       |
| `--keep-local` | Keep wrangler.toml and state.json entries     |

## Examples

```bash
# Destroy with confirmation prompt
npx zooid destroy

# Destroy without confirmation
npx zooid destroy --force

# Destroy remote resources but keep local config
npx zooid destroy --keep-local
```

## What gets destroyed

1. All channel Durable Objects (via `POST /api/v1/admin/destroy`)
2. The D1 database (via Cloudflare API)
3. The Worker (via Cloudflare API)
4. Local `wrangler.toml` (unless `--keep-local`)
5. Server entry in `~/.zooid/state.json` (unless `--keep-local`)

## Notes

- Requires Cloudflare credentials (same as `zooid deploy`).
- This is irreversible. All events, channels, webhooks, and keys are permanently deleted.
- Without `--force`, you must type the server name to confirm.
- Self-hosted only. Zoon-hosted server teardown is managed through the Zoon dashboard.
