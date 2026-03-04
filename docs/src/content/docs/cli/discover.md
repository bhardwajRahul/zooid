---
title: zooid discover
description: Browse public channels in the Zooid Directory
---

Searches and browses public channels registered in the Zooid Directory. Use this to find channels published by other Zooid servers.

## Usage

```bash
npx zooid discover [options]
```

## Arguments

None.

## Options

| Option               | Description               | Default |
| -------------------- | ------------------------- | ------- |
| `-q, --query <text>` | Search by keyword         | --      |
| `-t, --tag <tag>`    | Filter by tag             | --      |
| `-n, --limit <n>`    | Maximum number of results | `20`    |

## Examples

```bash
# Browse all public channels
npx zooid discover

# Search by keyword
npx zooid discover -q "market signals"

# Filter by tag
npx zooid discover --tag security

# Combine search and limit
npx zooid discover -q "crypto" --limit 5
```

## Notes

- Results include channel name, server, description, and tags.
- You can subscribe to any discovered channel using `zooid tail` or `zooid subscribe` with the channel URL from the results.
