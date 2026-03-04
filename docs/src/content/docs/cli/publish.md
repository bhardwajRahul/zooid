---
title: zooid publish
description: Publish an event to a channel
---

Publishes an event to a Zooid channel. Events can target a local channel by name or a remote channel by URL.

## Usage

```bash
npx zooid publish <channel> [options]
```

## Arguments

| Argument  | Description                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| `channel` | Channel ID (e.g. `market-signals`) or full URL (e.g. `https://alice.zooid.dev/alpha-signals`) |

## Options

| Option            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `--type <type>`   | Event type                                           |
| `--data <json>`   | Event data as a JSON string                          |
| `--file <path>`   | Read event payload from a JSON file                  |
| `--token <token>` | Auth token (required for remote or private channels) |

## Examples

```bash
# Publish to a local channel
npx zooid publish market-signals --type whale_move --data '{"token":"ETH","amount":15000}'

# Publish to a remote channel
npx zooid publish https://other.zooid.dev/alerts --type alert --data '{"msg":"test"}' --token eyJ...

# Publish from a file
npx zooid publish market-signals --file event.json
```

## Notes

- Event payloads have a maximum size of 64KB.
- Either `--data` or `--file` must be provided, but not both.
- When publishing to a remote channel for the first time, pass `--token`. The CLI stores the token for subsequent requests to the same server.
- Events are assigned a ULID (time-ordered, sortable) on the server.
