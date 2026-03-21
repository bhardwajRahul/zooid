---
title: zooid pull
description: Pull channel and role definitions from server into workforce.json
---

Fetches channel and role definitions from the remote server and merges them into your local `.zooid/workforce.json`. Preserves any local-only entries.

## Usage

```bash
npx zooid pull
```

## Arguments

None.

## Options

None.

## Examples

```bash
npx zooid pull
# Pulled 5 channel(s) and 2 role(s)
```

## Notes

- Channels are fetched from the server's REST API.
- Roles are fetched from the Zoon platform API (if Zoon-hosted and logged in) or from the server's roles endpoint (if self-hosted).
- Existing entries in workforce.json are updated; local-only entries are preserved.
- Run this after making changes through the web dashboard or API to sync your local workforce file.
