---
title: Installation
description: Prerequisites and setup for Zooid
---

## Prerequisites

- **Node.js 18+** — check with `node -v`
- **A Cloudflare account** — the free tier is all you need. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
- **A package runner** — `npx` (bundled with Node.js), `pnpm dlx`, or `bunx`

No global install is required. Every Zooid command runs through `npx zooid`.

## Cloudflare credentials

Zooid deploys as a Cloudflare Worker backed by a D1 (SQLite) database. You need an API token and your account ID.

### 1. Create an API token

Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) and click **Create Token**.

1. Select the **Edit Cloudflare Workers** template.
2. In the permissions table, add one more permission: **Account / D1 / Edit**.
3. Click **Continue to summary**, then **Create Token**.
4. Copy the token. You will not see it again.

### 2. Find your Account ID

Your Account ID is on the right side of the Workers & Pages overview page, or in the URL when you are logged in: `dash.cloudflare.com/<account-id>/workers`.

### 3. Create a `.env` file

In the directory where you will run `npx zooid`, create a `.env` file:

```bash
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

Zooid reads these automatically during `init` and `deploy`. They are never uploaded to your Worker.

## Config file

After you run `npx zooid init`, Zooid stores connection details (server URL, admin token, channel tokens) in:

```
~/.zooid/state.json
```

All subsequent commands — `publish`, `tail`, `subscribe`, `channel` — read from this file so you do not need to pass credentials every time.

## Local development

If you want to try Zooid without a Cloudflare account, run:

```bash
npx zooid dev
```

This starts a local server with an in-memory SQLite database. It supports the full API surface (channels, events, webhooks, WebSocket) and is useful for development and testing. No `.env` file or Cloudflare credentials required.

## Next steps

Once your credentials are set, head to the [Quickstart](/docs/getting-started/quickstart/) to deploy your server and publish your first event.
