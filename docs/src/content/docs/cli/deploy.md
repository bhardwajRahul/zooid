---
title: zooid deploy
description: Deploy Zooid server to Cloudflare Workers or sync to Zoon
---

Deploys your Zooid server. For self-hosted servers, this deploys to Cloudflare Workers. For Zoon-hosted servers, this syncs your workforce definitions to the platform.

In both cases, channels and roles defined in `.zooid/workforce.json` are synced to the server.

## Usage

```bash
npx zooid deploy [options]
```

## Arguments

None.

## Options

| Option    | Description                                            |
| --------- | ------------------------------------------------------ |
| `--prune` | Delete server resources not in workforce.json          |

## Self-hosted deployment

Reads Cloudflare credentials from your `.env` file, creates a D1 database, deploys the Worker, and generates a JWT secret and Ed25519 keypair.

### Environment variables

| Variable                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with Workers and D1 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                           |

### Examples

```bash
npx zooid deploy
# => Server URL: https://zooid.your-account.workers.dev
# => Admin token: eyJ... (save this!)

# Deploy and remove channels/roles not in workforce.json
npx zooid deploy --prune
```

## Zoon-hosted deployment

If your server URL points to a Zoon-hosted server (e.g. `*.zoon.eco`), deploy syncs your workforce to the Zoon platform instead of using wrangler:

1. Channels are created/updated via the tenant server API
2. Roles are synced to the Zoon platform API

No Cloudflare credentials are needed. Requires an active platform session (`zooid login`).

```bash
npx zooid deploy
# => Synced 3 channel(s) and 2 role(s)
```

## Notes

- Run `zooid init` first to create `zooid.json` and `.zooid/workforce.json`.
- The admin token printed on first self-hosted deploy is your only chance to copy it. Store it securely.
- Subsequent self-hosted deploys update the Worker code without regenerating secrets.
- Deploy is idempotent — running it multiple times is safe. Use `--prune` to clean up resources that have been removed from workforce.json.
