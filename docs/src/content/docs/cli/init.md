---
title: zooid init
description: Create zooid.json and workforce.json
---

Creates a `zooid.json` file with server identity and a `.zooid/workforce.json` file for channel and role definitions. Run this before `zooid deploy`.

## Usage

```bash
npx zooid init [options]
```

## Options

| Option         | Description                                     |
| -------------- | ----------------------------------------------- |
| `--use <url>`  | Include a template from a GitHub URL            |

## Examples

```bash
# Interactive setup — prompts for server name, description, etc.
npx zooid init

# Initialize with a template
npx zooid init --use https://github.com/zooid-ai/templates/tree/master/chat

# Same thing, two steps
npx zooid init
npx zooid use https://github.com/zooid-ai/templates/tree/master/chat
```

## With `--use`

When using `--use`, the CLI runs `zooid init` then `zooid use` in sequence:

1. Creates `zooid.json` and `.zooid/workforce.json` (the normal init flow).
2. Fetches the template's `.zooid/` directory into `.zooid/<slug>/`.
3. Adds the template to `include` in workforce.json.

See [`zooid use`](/docs/cli/use/) for details on how templates are fetched and included.

## Notes

- Creates `zooid.json` in the current directory and `.zooid/workforce.json`.
- If `zooid.json` already exists with a server URL (e.g. from `zooid login`), the interactive prompts are skipped.
- Both files should be committed to version control.
