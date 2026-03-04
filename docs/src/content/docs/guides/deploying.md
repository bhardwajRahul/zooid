---
title: Deploying
description: Deploy Zooid to Cloudflare Workers
---

Zooid deploys as a Cloudflare Worker with a D1 database. The CLI handles provisioning, configuration, and deployment in a single command.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A Cloudflare API token with **Workers** and **D1** permissions (create one at Account > API Tokens > Create Token)

## Configuration

Create a `.env` file in your project root:

```bash
CLOUDFLARE_API_TOKEN=your-api-token-here
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

Your account ID is visible in the Cloudflare dashboard sidebar on any zone or Workers page.

## Initialize

Run `npx zooid init` to create a `zooid-server.json` file with your server identity:

```bash
npx zooid init
```

This generates a unique server ID and prepares the project for deployment. The `zooid-server.json` file should be committed to version control.

## Deploy

```bash
npx zooid deploy
```

This single command:

1. Creates a Cloudflare Worker named `zooid-server`
2. Creates a D1 database and runs schema migrations
3. Generates a `ZOOID_JWT_SECRET` for token signing
4. Generates an Ed25519 keypair for webhook signatures
5. Returns your server URL and an admin token

Save the admin token -- it is only displayed once. You can mint new tokens later, but only with an existing admin token.

## Custom Domains

By default, your server runs at `https://zooid-server.<subdomain>.workers.dev`. This works, but `*.workers.dev` domains do not support `Cache-Control` headers through Cloudflare's CDN.

To enable CDN caching on public channels, add a custom domain:

1. Go to **Workers & Pages** in the Cloudflare dashboard
2. Select your `zooid-server` Worker
3. Click **Settings > Domains & Routes**
4. Add a custom domain (e.g., `zooid.yourdomain.com`)

With a custom domain, poll responses for public channels include `Cache-Control: public, s-maxage=N`, and Cloudflare serves cached responses at the edge without invoking the Worker.

## Environment Variables

The following environment variables are set automatically on deploy:

| Variable              | Description                                    |
| --------------------- | ---------------------------------------------- |
| `ZOOID_JWT_SECRET`    | Legacy HS256 secret (EdDSA is used by default) |
| `ZOOID_SIGNING_KEY`   | Ed25519 private key for webhook signatures     |
| `ZOOID_SERVER_ID`     | Unique server identifier                       |
| `ZOOID_POLL_INTERVAL` | Default poll interval in seconds (default: 30) |

You can override these in the Cloudflare dashboard under Worker Settings > Variables, or pass them during deploy:

```bash
npx zooid deploy --var ZOOID_POLL_INTERVAL=60
```

## Re-deploying

`npx zooid deploy` is idempotent. Running it again updates the Worker code and runs any pending D1 migrations. It does not regenerate secrets or overwrite existing environment variables.

```bash
npx zooid deploy
```

## Local Development

Run a local development server with an in-memory SQLite database:

```bash
npx zooid dev
```

This starts the server on `http://localhost:8787` with hot reloading. The local server behaves identically to production, but data does not persist between restarts.

To use a persistent local database:

```bash
npx zooid dev --persist
```
