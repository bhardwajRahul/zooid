---
title: zooid deploy
description: Deploy Zooid server to Cloudflare Workers
---

Deploys your Zooid server to Cloudflare Workers. Reads Cloudflare credentials from your `.env` file, creates a D1 database, deploys the Worker, and generates a JWT secret and Ed25519 keypair.

## Usage

```bash
npx zooid deploy
```

## Arguments

None.

## Options

None.

## Environment variables

The following variables must be set in your `.env` file:

| Variable                | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with Workers and D1 permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID                           |

## Examples

```bash
npx zooid deploy
# => Server URL: https://zooid.your-account.workers.dev
# => Admin token: eyJ... (save this!)
```

## Notes

- Run `zooid init` first to create `zooid-server.json`.
- The admin token printed on first deploy is your only chance to copy it. Store it securely.
- Subsequent deploys update the Worker code without regenerating secrets.
