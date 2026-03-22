---
title: Workforce
description: Define channels, roles, and agents in workforce.json
---

The workforce file is the single source of truth for your Zooid server's channels and access control. It lives at `.zooid/workforce.json` in your project root and is synced to the server on `zooid deploy`.

## File structure

```json
{
  "$schema": "https://zooid.dev/schemas/workforce.json",
  "meta": {
    "name": "Trading Desk",
    "slug": "trading-desk",
    "description": "Channels and roles for an AI trading team",
    "tags": ["finance", "trading"]
  },
  "include": ["./chat/workforce.json"],
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

### `$schema`

Adding `$schema` gives you IDE autocomplete, hover docs, and validation for free. Point it at `https://zooid.dev/schemas/workforce.json`.

### `meta`

Optional metadata about this workforce. Used by `zooid use` to determine the directory name when this project is used as a template, and by the future template registry for discovery.

| Field         | Type     | Required | Description                                     |
| ------------- | -------- | -------- | ----------------------------------------------- |
| `name`        | string   | No       | Human-readable name                             |
| `slug`        | string   | No       | Directory name when used as a template (valid slug: lowercase alphanumeric + hyphens, 3-64 chars) |
| `description` | string   | No       | What this workforce does                        |
| `tags`        | string[] | No       | Discovery tags                                  |

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

You can mix `roles` and `agents` in the same file. Agents compile to roles after all included files are merged, so an agent in one file can reference channels defined in another.

## Include

Split your workforce across multiple files using `include`. Each entry is a relative path to another workforce file within `.zooid/`.

```json
{
  "include": ["./chat/workforce.json", "./pipelines/ingest.json"],
  "channels": {
    "announcements": { "visibility": "public" }
  },
  "roles": {
    "admin": { "scopes": ["admin"] }
  }
}
```

### How it works

1. Files are loaded depth-first — included files are resolved before the declaring file.
2. Channels, roles, and agents are merged per-key. Later files take precedence.
3. The declaring file always wins over its included files.
4. Agents compile to roles once, after all files are merged.
5. `meta`, `$schema`, and `include` are per-file — they're not merged.

### Recursive include

Included files can themselves have `include`:

```
workforce.json includes [./chat/workforce.json, ./monitoring/workforce.json]
  chat/workforce.json includes [./base-messaging.json]
  monitoring/workforce.json (no include)
```

Merge order: `base-messaging.json` → `chat/workforce.json` → `monitoring/workforce.json` → `workforce.json`.

### Rules

- Paths must be relative and stay within `.zooid/`.
- Circular includes are detected and error.
- If two included files define the same channel or role, the CLI warns (last wins).

## Project layout

```
my-project/
├── zooid.json                 # Server identity (name, URL, metadata)
├── .zooid/
│   ├── workforce.json         # Your channels, roles, includes
│   ├── chat/                  # Added via `zooid use`
│   │   └── workforce.json
│   └── monitoring/            # Added via `zooid use`
│       └── workforce.json
├── .env                       # Cloudflare credentials (self-hosted)
└── wrangler.toml              # Generated on first deploy (self-hosted)
```

- `zooid.json` — Created by `zooid init`. Contains server name, description, URL, and metadata.
- `.zooid/workforce.json` — Created by `zooid init`. Defines what gets deployed.
- `.zooid/<name>/` — Template directories added via `zooid use`.

## Sync lifecycle

### Deploy (local to server)

`zooid deploy` reads workforce.json (resolving all includes), and syncs the result to the server:

- **Self-hosted**: Creates/updates channels via API, writes role scope mapping to `wrangler.toml`, deploys the Worker.
- **Zoon-hosted**: Creates/updates channels via API, syncs roles to Zoon platform API.

Use `--prune` to delete server-side channels and roles that are not in the resolved workforce.

### Pull (server to local)

`zooid pull` fetches the current state from the server and writes it into the correct workforce files. Channels and roles are written to whichever file currently defines them (provenance-aware). New resources go into the root workforce.json.

## CLI commands

These commands read from and write to workforce.json:

| Command                             | Effect on workforce.json                |
| ----------------------------------- | --------------------------------------- |
| `zooid init`                        | Creates empty workforce.json            |
| `zooid init --use <url>`            | Creates workforce.json + fetches template |
| `zooid use <url>`                   | Fetches template into `.zooid/<slug>/`, adds to include |
| `zooid deploy`                      | Reads (resolves includes) and syncs to server |
| `zooid pull`                        | Writes server state to the correct file |
| `zooid channel create`              | Adds to server AND root workforce.json  |
| `zooid channel update`              | Updates server AND the file that owns it |
| `zooid channel delete`              | Removes from server AND the file that owns it |
| `zooid role create\|update\|delete` | Modifies the file that owns the role    |
| `zooid token mint --role <name>`    | Reads role scopes from resolved workforce |
| `zooid credentials create`          | Reads role scopes from resolved workforce |

## Templates

### Using a template

Add a template to your project with `zooid use`:

```bash
npx zooid use https://github.com/zooid-ai/templates/tree/master/chat
```

This fetches the template's `.zooid/` directory into `.zooid/chat/` and adds it to `include` in your workforce.json. The directory name comes from `meta.slug` in the template's workforce.json, or falls back to the URL path.

### Using a template with init

Start a new project with a template in one step:

```bash
npx zooid init --use https://github.com/zooid-ai/templates/tree/master/chat
```

This is equivalent to `zooid init` followed by `zooid use`.

### Multiple templates

```bash
npx zooid use https://github.com/zooid-ai/templates/tree/master/chat
npx zooid use https://github.com/zooid-ai/templates/tree/master/monitoring
```

### Any project is a template

There's no special template format. Any project with `.zooid/workforce.json` can be used as a template. Template files are yours to edit, reorganize, or delete — they're just workforce files in subdirectories.
