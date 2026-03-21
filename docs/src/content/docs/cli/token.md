---
title: zooid token
description: Mint JWT tokens
---

Generates JWT tokens for authenticating with your Zooid server. Tokens carry an array of scopes that define access.

## Usage

```bash
npx zooid token mint <scopes...> [options]
```

## Arguments

| Argument | Description                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- |
| `scopes` | One or more scope strings: `admin`, `pub:<channel>`, `sub:<channel>`, `pub:*`, `sub:*`, etc. |

## Options

| Option                    | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| `--role <roles...>`       | Mint with scopes from named roles in workforce.json      |
| `--sub <sub>`             | Subject identifier (e.g. publisher ID)                   |
| `--name <name>`           | Display name (publisher identity)                        |
| `--expires-in <duration>` | Token expiry duration (e.g. `5m`, `1h`, `7d`, `30d`)     |

## Examples

```bash
# Mint an admin token
npx zooid token mint admin

# Publish + subscribe token for a channel
npx zooid token mint pub:market-signals sub:market-signals --name "whale-bot"

# Subscribe-only token with an expiry
npx zooid token mint sub:market-signals --expires-in 7d

# Wildcard publish token
npx zooid token mint pub:* --expires-in 30d

# Prefix wildcard for a group of channels
npx zooid token mint pub:product-* sub:product-* --sub "bot-001" --name "Product Bot"

# Mint using a role defined in workforce.json
npx zooid token mint --role analyst

# Mint with multiple roles
npx zooid token mint --role analyst --role publisher --expires-in 7d
```

## Notes

- `admin` grants full access to the server (channel management, token minting, server configuration).
- `pub:<channel>` authorizes publishing events to the specified channel.
- `sub:<channel>` authorizes reading events from the specified channel.
- Wildcards (`pub:*`, `sub:*`) grant access to all channels. Prefix wildcards (`pub:product-*`) match channels starting with the prefix.
- Tokens are signed with EdDSA (Ed25519) using the server's signing key.
- If `--expires-in` is omitted, the token does not expire.
- `--role` reads scopes from `.zooid/workforce.json`. You can pass `--role` instead of listing scopes explicitly.
- Scopes and `--role` can be combined — the resulting token gets the union of all scopes.
