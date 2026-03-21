---
title: zooid logout
description: Clear authentication for the current server
---

Removes stored authentication tokens for the current server or all servers.

## Usage

```bash
npx zooid logout [options]
```

## Arguments

None.

## Options

| Option  | Description                |
| ------- | -------------------------- |
| `--all` | Log out of all servers     |

## Examples

```bash
# Log out of the current server
npx zooid logout

# Log out of all servers
npx zooid logout --all
```

## Notes

- Without `--all`, only the currently configured server's tokens are removed.
- This clears both the Zooid JWT and platform session (if present).
