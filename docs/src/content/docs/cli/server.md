---
title: zooid server
description: Get and update server metadata
---

View and update metadata for your Zooid server, including display name, description, tags, and contact information.

## server get

Displays the current server metadata.

### Usage

```bash
npx zooid server get
```

### Arguments

None.

### Options

None.

---

## server set

Updates server metadata fields.

### Usage

```bash
npx zooid server set [options]
```

### Arguments

None.

### Options

| Option                 | Description          |
| ---------------------- | -------------------- |
| `--name <name>`        | Server display name  |
| `--description <desc>` | Server description   |
| `--tags <csv>`         | Comma-separated tags |
| `--owner <owner>`      | Owner name           |
| `--company <company>`  | Company name         |
| `--email <email>`      | Contact email        |

---

## Examples

```bash
# View current server metadata
npx zooid server get

# Update server name and description
npx zooid server set --name "My Signals" --description "Market intelligence"

# Set tags and contact info
npx zooid server set --tags "finance,crypto" --owner "Alice" --email "alice@example.com"
```

## Notes

- Server metadata is visible in the `/.well-known/zooid.json` manifest and the web dashboard.
- Tags are used for discovery in the Zooid Directory when you run `zooid share`.
