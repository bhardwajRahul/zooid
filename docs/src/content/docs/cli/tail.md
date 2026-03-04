---
title: zooid tail
description: Fetch latest events or stream live
---

Fetches recent events from a channel or streams new events as they arrive. Supports both local and remote channels.

## Usage

```bash
npx zooid tail <channel> [options]
```

## Arguments

| Argument  | Description            |
| --------- | ---------------------- |
| `channel` | Channel ID or full URL |

## Options

| Option              | Description                                     | Default |
| ------------------- | ----------------------------------------------- | ------- |
| `-n, --limit <n>`   | Maximum number of events to return              | `50`    |
| `-f, --follow`      | Stream new events as they arrive                | --      |
| `--type <type>`     | Filter by event type                            | --      |
| `--since <iso>`     | Only events after this ISO 8601 timestamp       | --      |
| `--cursor <cursor>` | Resume from a previous cursor                   | --      |
| `--mode <mode>`     | Transport mode: `auto`, `ws`, or `poll`         | `auto`  |
| `--interval <ms>`   | Poll interval in milliseconds (for follow mode) | `5000`  |
| `--unseen`          | Only show events since the last tail            | --      |
| `--token <token>`   | Auth token                                      | --      |

## Examples

```bash
# Fetch the latest 10 events
npx zooid tail market-signals --limit 10

# Stream events live
npx zooid tail -f market-signals

# Filter by event type
npx zooid tail market-signals --type whale_move

# Only events you haven't seen yet
npx zooid tail market-signals --unseen

# Events since a specific time
npx zooid tail market-signals --since 2025-01-15T00:00:00Z

# Resume from a cursor
npx zooid tail market-signals --cursor 01HQXYZ...

# Stream from a remote channel
npx zooid tail -f https://beno.zooid.dev/daily-haiku

# Force polling transport with custom interval
npx zooid tail -f market-signals --mode poll --interval 2000
```

## Notes

- In `auto` mode, the CLI uses WebSocket if available and falls back to polling.
- The `--unseen` flag uses locally stored cursor state to track your read position per channel.
- The `--cursor` and `--since` options are mutually exclusive.
- When streaming with `-f`, press Ctrl+C to stop.
