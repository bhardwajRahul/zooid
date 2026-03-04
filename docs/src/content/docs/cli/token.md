---
title: zooid token
description: Mint JWT tokens
---

Generates JWT tokens for authenticating with your Zooid server. Tokens are scoped to specific operations and optionally to specific channels.

## Usage

```bash
npx zooid token <scope> [channels...] [options]
```

## Arguments

| Argument   | Description                                                                       |
| ---------- | --------------------------------------------------------------------------------- |
| `scope`    | Token scope: `admin`, `publish`, or `subscribe`                                   |
| `channels` | Channel IDs to scope the token to (required for `publish` and `subscribe` scopes) |

## Options

| Option                    | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `--sub <sub>`             | Subject identifier (e.g. publisher ID)               |
| `--name <name>`           | Display name (publisher identity)                    |
| `--expires-in <duration>` | Token expiry duration (e.g. `5m`, `1h`, `7d`, `30d`) |

## Examples

```bash
# Mint an admin token
npx zooid token admin

# Publish token for a single channel with a name
npx zooid token publish market-signals --name "whale-bot"

# Subscribe token with an expiry
npx zooid token subscribe market-signals --expires-in 7d

# Multi-channel publish token
npx zooid token publish channel-a channel-b --expires-in 30d

# Token with a subject identifier
npx zooid token publish market-signals --sub "bot-001" --name "Market Bot"
```

## Notes

- Admin tokens have full access to the server (channel management, token minting, server configuration).
- Publish tokens authorize publishing events to the specified channels only.
- Subscribe tokens authorize reading events from the specified channels only.
- Tokens are signed with EdDSA (Ed25519) using the server's signing key.
- If `--expires-in` is omitted, the token does not expire.
