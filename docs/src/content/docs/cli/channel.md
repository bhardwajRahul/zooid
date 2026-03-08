---
title: zooid channel
description: Create, list, update, and delete channels
---

Manage channels on your Zooid server. Channels are named endpoints that events are published to and consumed from.

## channel create

Creates a new channel and returns publish and subscribe tokens.

### Usage

```bash
npx zooid channel create <id> [options]
```

### Arguments

| Argument | Description                                                  |
| -------- | ------------------------------------------------------------ |
| `id`     | URL-safe slug (lowercase alphanumeric + hyphens, 3-64 chars) |

### Options

| Option                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `--name <name>`        | Display name (defaults to id)                   |
| `--description <desc>` | Channel description                             |
| `--public`             | Make channel public (default)                   |
| `--private`            | Make channel private                            |
| `--strict`             | Set `config.strict_types: true`                 |
| `--config <file>`      | Path to channel config JSON file                |
| `--schema <file>`      | Path to JSON schema file (shorthand for config) |

### Examples

```bash
# Create a public channel
npx zooid channel create market-signals

# Create a private channel with a description
npx zooid channel create internal-alerts --private --description "Internal monitoring alerts"

# Create a channel with full config (types, storage, etc.)
npx zooid channel create typed-events --config ./channel.json

# Create a channel with schema validation (shorthand)
npx zooid channel create typed-events --strict --schema ./event-schema.json
```

---

## channel list

Lists all channels on the server with their visibility and event count.

### Usage

```bash
npx zooid channel list
```

### Arguments

None.

### Options

None.

### Examples

```bash
npx zooid channel list
```

---

## channel update

Updates an existing channel's metadata or configuration.

### Usage

```bash
npx zooid channel update <id> [options]
```

### Arguments

| Argument | Description          |
| -------- | -------------------- |
| `id`     | Channel ID to update |

### Options

| Option                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `--name <name>`        | Update display name                             |
| `--description <desc>` | Update description                              |
| `--tags <csv>`         | Set tags (comma-separated)                      |
| `--public`             | Make channel public                             |
| `--private`            | Make channel private                            |
| `--strict`             | Set `config.strict_types: true`                 |
| `--no-strict`          | Set `config.strict_types: false`                |
| `--config <file>`      | Path to channel config JSON file                |
| `--schema <file>`      | Path to JSON schema file (shorthand for config) |

### Examples

```bash
# Add tags to a channel
npx zooid channel update market-signals --tags "finance,crypto,realtime"

# Make a channel private
npx zooid channel update internal-alerts --private

# Update description and enable schema validation
npx zooid channel update typed-events --description "Validated events only" --strict --schema ./schema.json
```

---

## channel delete

Deletes a channel and all its associated events and webhook subscriptions.

### Usage

```bash
npx zooid channel delete <id> [options]
```

### Arguments

| Argument | Description          |
| -------- | -------------------- |
| `id`     | Channel ID to delete |

### Options

| Option      | Description              |
| ----------- | ------------------------ |
| `-y, --yes` | Skip confirmation prompt |

### Examples

```bash
# Delete with confirmation prompt
npx zooid channel delete old-channel

# Delete without confirmation
npx zooid channel delete old-channel --yes
```

## Notes

- Channel IDs must be URL-safe slugs: lowercase letters, numbers, and hyphens only, between 3 and 64 characters.
- Deleting a channel is irreversible. All events and webhook registrations for that channel are permanently removed.
- Public channels are readable without authentication. Private channels require a subscribe token.
