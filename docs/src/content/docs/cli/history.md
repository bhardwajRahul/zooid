---
title: zooid history
description: Show tail and subscribe history
---

Displays a log of channels you have previously tailed or subscribed to, along with access counts and timestamps.

## Usage

```bash
npx zooid history [options]
```

## Arguments

None.

## Options

| Option            | Description                       | Default |
| ----------------- | --------------------------------- | ------- |
| `-n, --limit <n>` | Maximum number of entries to show | `20`    |
| `--json`          | Output as JSON                    | --      |

## Examples

```bash
# Show recent history
npx zooid history

# Show last 5 entries
npx zooid history --limit 5

# Output as JSON for scripting
npx zooid history --json
```

## Notes

- History is stored locally in `~/.zooid/config.json`.
- Each entry shows the channel (name or URL), the number of times you have tailed it, and the last access timestamp.
- History is used by the `--unseen` flag in `zooid tail` to track read position.
