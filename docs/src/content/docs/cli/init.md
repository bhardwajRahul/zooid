---
title: zooid init
description: Create zooid.json and workforce.json
---

Creates a `zooid.json` file with server identity and a `.zooid/workforce.json` file for channel and role definitions. Run this before `zooid deploy`.

## Usage

```bash
npx zooid init [options]
```

## Arguments

None.

## Options

| Option              | Description                            |
| ------------------- | -------------------------------------- |
| `--template <url>`  | Initialize from a GitHub template URL  |

## Examples

```bash
# Interactive setup — prompts for server name, description, etc.
npx zooid init

# Initialize from a GitHub template
npx zooid init --template https://github.com/zooid-ai/trading-desk

# Template with a specific path in the repo
npx zooid init --template https://github.com/org/repo/tree/main/examples/my-template
```

## Templates

When using `--template`, the CLI downloads the repository and copies:

- `.zooid/workforce.json` — channel and role definitions (required in template)
- `zooid.json` — server identity (copied only if you don't already have one)

Templates must contain a `.zooid/workforce.json` with at least one channel or role.

## Notes

- Creates `zooid.json` in the current directory and `.zooid/workforce.json`.
- If `zooid.json` already exists with a server URL (e.g. from `zooid login`), the interactive prompts are skipped.
- Both files should be committed to version control.
