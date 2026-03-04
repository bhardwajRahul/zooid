---
title: zooid unshare
description: Remove a channel from the Zooid Directory
---

Removes a previously shared channel from the public Zooid Directory.

## Usage

```bash
npx zooid unshare <channel>
```

## Arguments

| Argument  | Description                             |
| --------- | --------------------------------------- |
| `channel` | Channel ID to remove from the directory |

## Options

None.

## Examples

```bash
# Remove a channel from the directory
npx zooid unshare market-signals
```

## Notes

- This only removes the channel from the directory listing. The channel itself and its events remain on your server.
- Use `zooid share` to re-add a channel to the directory later.
