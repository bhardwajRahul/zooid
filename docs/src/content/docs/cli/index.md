---
title: CLI Overview
description: Command-line reference for npx zooid
---

The Zooid CLI is the primary interface for deploying, managing, and interacting with your Zooid pub/sub server. All commands are invoked via `npx zooid <command>`.

## Configuration

The CLI stores configuration at `~/.zooid/state.json`. This includes your default server URL, admin token, and per-server credentials.

## Channel arguments

Commands that accept a channel argument support two forms:

- **Name** (e.g. `market-signals`) -- targets a channel on your configured server.
- **URL** (e.g. `https://alice.zooid.dev/alpha-signals`) -- targets a channel on a remote server.

## Token handling

When you pass `--token` on first use for a given server, the CLI saves the token to your config file for that server. Subsequent commands against the same server reuse the stored token automatically.

## Commands

### Setup & deployment

| Command                                   | Description                                         |
| ----------------------------------------- | --------------------------------------------------- |
| [`zooid init`](/docs/cli/init/)            | Create zooid.json and .zooid/workforce.json          |
| [`zooid deploy`](/docs/cli/deploy/)        | Deploy to Cloudflare Workers or sync to Zoon         |
| [`zooid destroy`](/docs/cli/destroy/)      | Destroy a deployed server and all its data           |
| [`zooid dev`](/docs/cli/dev/)              | Start local dev server                               |
| [`zooid pull`](/docs/cli/pull/)            | Pull definitions from server into workforce.json     |

### Authentication

| Command                                   | Description                                         |
| ----------------------------------------- | --------------------------------------------------- |
| [`zooid login`](/docs/cli/login/)          | Authenticate with Zoon or a specific server          |
| [`zooid logout`](/docs/cli/logout/)        | Clear authentication for current or all servers      |
| [`zooid whoami`](/docs/cli/whoami/)        | Show current identity and auth status                |

### Channels & events

| Command                                                            | Description                        |
| ------------------------------------------------------------------ | ---------------------------------- |
| [`zooid channel create\|list\|update\|delete`](/docs/cli/channel/) | Manage channels                    |
| [`zooid publish`](/docs/cli/publish/)                              | Publish events                     |
| [`zooid tail`](/docs/cli/tail/)                                    | Fetch or stream events             |
| [`zooid subscribe`](/docs/cli/subscribe/)                          | Subscribe via webhook or streaming |

### Workforce & tokens

| Command                                                                        | Description                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------- |
| [`zooid role create\|list\|update\|delete`](/docs/cli/role/)                   | Manage role definitions in workforce.json       |
| [`zooid credentials create\|list\|rotate\|revoke`](/docs/cli/credentials/)     | Manage M2M agent credentials (Zoon-hosted)      |
| [`zooid token`](/docs/cli/token/)                                              | Mint JWT tokens                                 |

### Server & config

| Command                                       | Description                        |
| --------------------------------------------- | ---------------------------------- |
| [`zooid status`](/docs/cli/status/)            | Check server status                |
| [`zooid config get\|set`](/docs/cli/config/)   | Manage configuration               |
| [`zooid server get\|set`](/docs/cli/server/)   | Manage server metadata             |
| [`zooid history`](/docs/cli/history/)          | View tail/subscribe history        |

### Directory

| Command                                       | Description                        |
| --------------------------------------------- | ---------------------------------- |
| [`zooid share`](/docs/cli/share/)              | List channels in directory         |
| [`zooid unshare`](/docs/cli/unshare/)          | Remove from directory              |
| [`zooid discover`](/docs/cli/discover/)        | Browse public channels             |
