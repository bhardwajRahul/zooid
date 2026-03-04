---
title: zooid config
description: Manage Zooid configuration
---

Read and write values in the Zooid CLI configuration file stored at `~/.zooid/config.json`.

## config set

Sets a configuration value.

### Usage

```bash
npx zooid config set <key> <value>
```

### Arguments

| Argument | Description                                                |
| -------- | ---------------------------------------------------------- |
| `key`    | Configuration key: `server`, `admin-token`, or `telemetry` |
| `value`  | Value to set                                               |

---

## config get

Reads a configuration value.

### Usage

```bash
npx zooid config get <key>
```

### Arguments

| Argument | Description               |
| -------- | ------------------------- |
| `key`    | Configuration key to read |

---

## Examples

```bash
# Set the default server URL
npx zooid config set server https://zooid.my-account.workers.dev

# Read the current server URL
npx zooid config get server

# Disable telemetry
npx zooid config set telemetry off
```

## Notes

- Configuration is stored at `~/.zooid/config.json`.
- The `server` key sets the default server URL used by all commands when a channel is referenced by name instead of full URL.
- The `admin-token` key stores the admin token for the default server.
- Per-server tokens saved via `--token` flags are also stored in this config file, keyed by server URL.
