---
title: Workforce
description: Define channels, roles, and agents in workforce.json
---

The workforce file is the single source of truth for your Zooid server's channels and access control. It lives at `.zooid/workforce.json` in your project root and is synced to the server on `zooid deploy`.

## File structure

```json
{
  "channels": {
    "market-signals": {
      "visibility": "public",
      "name": "Market Signals",
      "description": "Real-time trading signals"
    },
    "internal-alerts": {
      "visibility": "private",
      "name": "Internal Alerts"
    }
  },
  "roles": {
    "admin": {
      "scopes": ["admin"],
      "name": "Administrator"
    },
    "analyst": {
      "scopes": ["pub:market-signals", "sub:*"],
      "name": "Market Analyst",
      "description": "Can publish signals and subscribe to all channels"
    }
  }
}
```

## Channels

Each key in `channels` is the channel ID (URL-safe slug, 3-64 chars).

| Field          | Type    | Required | Description                                        |
| -------------- | ------- | -------- | -------------------------------------------------- |
| `visibility`   | string  | Yes      | `"public"` or `"private"`                          |
| `name`         | string  | No       | Display name (defaults to channel ID)              |
| `description`  | string  | No       | Channel description                                |
| `config`       | object  | No       | Channel config (JSON schema, policies, strict mode)|

## Roles

Each key in `roles` is the role ID.

| Field          | Type     | Required | Description                                     |
| -------------- | -------- | -------- | ----------------------------------------------- |
| `scopes`       | string[] | Yes      | Array of scopes (`admin`, `pub:X`, `sub:X`)     |
| `name`         | string   | No       | Display name                                    |
| `description`  | string   | No       | Role description                                |

## Agents (shorthand)

Instead of defining explicit roles, you can use the `agents` shorthand. Agents are compiled to roles automatically:

```json
{
  "channels": {
    "signals": { "visibility": "public" },
    "alerts": { "visibility": "private" }
  },
  "agents": {
    "market-bot": {
      "name": "Market Bot",
      "publishes": ["signals"],
      "subscribes": ["signals", "alerts"]
    },
    "dashboard": {
      "name": "Dashboard",
      "subscribes": ["signals", "alerts"]
    }
  }
}
```

This compiles to:

- `market-bot` role: `["pub:signals", "sub:signals", "sub:alerts"]`
- `dashboard` role: `["sub:signals", "sub:alerts"]`

You can mix `roles` and `agents` in the same file.

## Project layout

```
my-project/
├── zooid.json                 # Server identity (name, URL, metadata)
├── .zooid/
│   └── workforce.json         # Channels, roles, agents
├── .env                       # Cloudflare credentials (self-hosted)
└── wrangler.toml              # Generated on first deploy (self-hosted)
```

- `zooid.json` — Created by `zooid init`. Contains server name, description, URL, and metadata.
- `.zooid/workforce.json` — Created by `zooid init`. Defines what gets deployed.

## Sync lifecycle

### Deploy (local to server)

`zooid deploy` reads workforce.json and syncs it to the server:

- **Self-hosted**: Creates/updates channels via API, writes role scope mapping to `wrangler.toml`, deploys the Worker.
- **Zoon-hosted**: Creates/updates channels via API, syncs roles to Zoon platform API.

Use `--prune` to delete server-side channels and roles that are not in workforce.json.

### Pull (server to local)

`zooid pull` fetches the current state from the server and merges it into workforce.json. Local-only entries are preserved.

## CLI commands

These commands read from and write to workforce.json:

| Command                          | Effect on workforce.json           |
| -------------------------------- | ---------------------------------- |
| `zooid init`                     | Creates empty workforce.json       |
| `zooid init --template <url>`    | Fetches workforce.json from GitHub |
| `zooid deploy`                   | Reads and syncs to server          |
| `zooid pull`                     | Merges server state into file      |
| `zooid channel create`           | Adds to server AND workforce.json  |
| `zooid channel update`           | Updates server AND workforce.json  |
| `zooid channel delete`           | Removes from server AND workforce.json |
| `zooid role create\|update\|delete` | Modifies workforce.json only    |
| `zooid token mint --role <name>` | Reads role scopes from file        |
| `zooid credentials create`       | Reads role scopes from file        |

## Templates

Initialize a project from a template that includes a workforce.json:

```bash
npx zooid init --template https://github.com/zooid-ai/trading-desk
npx zooid init --template https://github.com/org/repo/tree/main/examples/my-template
```

The CLI downloads the repository, extracts `.zooid/workforce.json` (and optionally `zooid.json`), and copies them into your project.
