---
title: zooid publish
description: Publish an event to a channel
---

Publishes an event to a Zooid channel. Events can target a local channel by name or a remote channel by URL.

## Usage

```bash
npx zooid publish <channel> [data] [options]
```

## Arguments

| Argument  | Description                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| `channel` | Channel ID (e.g. `market-signals`) or full URL (e.g. `https://alice.zooid.dev/alpha-signals`) |
| `data`    | Event data as a JSON string (optional — can also use `--data`, `--file`, or stdin)            |

## Options

| Option            | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `--type <type>`   | Event type                                                         |
| `--data <json>`   | Event data as a JSON string                                        |
| `--file <path>`   | Read event payload from a JSON file                                |
| `--stream`        | Stream mode: read newline-delimited JSON from stdin, publish each line |
| `--token <token>` | Auth token (required for remote or private channels)               |

## Examples

```bash
# Publish with inline JSON (positional argument)
npx zooid publish market-signals '{"token":"ETH","amount":15000}'

# Publish with a type
npx zooid publish market-signals --type whale_move '{"token":"ETH","amount":15000}'

# Pipe from stdin
echo '{"msg":"hello"}' | npx zooid publish market-signals
cat event.json | npx zooid publish market-signals

# Publish to a remote channel
npx zooid publish https://other.zooid.dev/alerts '{"msg":"test"}' --token eyJ...

# Publish from a file
npx zooid publish market-signals --file event.json

# Legacy flag form (still works)
npx zooid publish market-signals --data '{"token":"ETH","amount":15000}'
```

### Stream mode

Stream mode reads newline-delimited JSON (JSONL) from stdin and publishes each line as a separate event. Useful for piping logs, batch data, or continuous output from other commands.

```bash
# Publish a JSONL file line by line
cat events.jsonl | npx zooid publish market-signals --stream

# Pipe output from another command
some-api --watch | npx zooid publish market-signals --stream --type metric

# Combine with jq
cat data.json | jq -c '.items[]' | npx zooid publish market-signals --stream
```

Blank lines are skipped. If a line fails to publish, the error is printed to stderr and streaming continues. A summary is printed at the end.

## Notes

- All input must be valid JSON. The CLI validates before sending — invalid JSON fails immediately.
- Data can be provided as a positional argument, via `--data`, `--file`, or piped through stdin.
- If multiple sources are given, precedence is: `--file` > `--data` > positional arg > stdin.
- In stream mode (`--stream`), `--type` is applied to every event.
- Event payloads have a maximum size of 64KB per event.
- When publishing to a remote channel for the first time, pass `--token`. The CLI stores the token for subsequent requests to the same server.
- Events are assigned a ULID (time-ordered, sortable) on the server.
