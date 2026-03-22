---
title: zooid use
description: Add a template to your workforce via include
---

Fetches a template from a GitHub URL and adds it to your workforce as an included file.

## Usage

```bash
npx zooid use <url>
```

## Arguments

| Argument | Description                              |
| -------- | ---------------------------------------- |
| `url`    | GitHub URL to a repo or subdirectory     |

## Examples

```bash
# Add a chat template
npx zooid use https://github.com/zooid-ai/templates/tree/master/chat

# Add a monitoring template
npx zooid use https://github.com/zooid-ai/templates/tree/master/monitoring

# Add from a repo root
npx zooid use https://github.com/zooid-ai/trading-desk
```

## What happens

1. Fetches the template repo/subdirectory as a tarball.
2. Reads `meta.slug` from the template's workforce.json for the directory name. Falls back to the URL path.
3. Copies the entire `.zooid/` directory from the template into `.zooid/<slug>/`.
4. Adds `"./<slug>/workforce.json"` to the `include` array in your workforce.json.

## Result

```
.zooid/
├── workforce.json              # include: ["./chat/workforce.json"]
└── chat/
    └── workforce.json          # the template's workforce
```

The template's channels and roles are now part of your resolved workforce. Run `zooid deploy` to sync them to the server.

## Naming

The directory name is determined by:

1. **`meta.slug`** in the template's workforce.json (preferred).
2. Last segment of the URL path (fallback).
3. Repo name if no subpath (fallback).

## Notes

- Templates are just workforce files. Edit them, delete them, reorganize them.
- If the template has internal `include` references, they resolve correctly because the entire `.zooid/` directory is copied.
- To remove a template, delete its directory and remove it from `include`.
- Also available as `zooid init --use <url>` to combine init and use in one step.
