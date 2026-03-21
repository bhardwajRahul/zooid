---
title: zooid role
description: Manage role definitions in workforce.json
---

Manage role definitions in your local `.zooid/workforce.json`. Roles define named sets of scopes that can be used with `zooid token mint --role` and `zooid credentials create --role`.

## role create

Creates a new role definition.

### Usage

```bash
npx zooid role create <id> <scopes...> [options]
```

### Arguments

| Argument  | Description                                                      |
| --------- | ---------------------------------------------------------------- |
| `id`      | Role identifier                                                  |
| `scopes`  | Scopes to grant (e.g. `admin`, `pub:signals`, `sub:market-data`) |

### Options

| Option                 | Description      |
| ---------------------- | ---------------- |
| `--name <name>`        | Display name     |
| `--description <desc>` | Role description |

### Examples

```bash
# Create an admin role
npx zooid role create admin admin

# Create a role with multiple scopes
npx zooid role create analyst pub:signals sub:market-data sub:alerts --name "Market Analyst"
```

---

## role list

Lists all role definitions in workforce.json.

### Usage

```bash
npx zooid role list
```

---

## role update

Updates an existing role definition.

### Usage

```bash
npx zooid role update <id> [options]
```

### Arguments

| Argument | Description        |
| -------- | ------------------ |
| `id`     | Role ID to update  |

### Options

| Option                   | Description      |
| ------------------------ | ---------------- |
| `--name <name>`          | Display name     |
| `--description <desc>`   | Role description |
| `--scopes <scopes...>`   | Replace scopes   |

### Examples

```bash
# Add subscribe-all scope to a role
npx zooid role update analyst --scopes pub:signals sub:*
```

---

## role delete

Deletes a role definition from workforce.json.

### Usage

```bash
npx zooid role delete <id> [options]
```

### Options

| Option      | Description              |
| ----------- | ------------------------ |
| `-y, --yes` | Skip confirmation prompt |

## Notes

- Roles are local-only — they modify `.zooid/workforce.json` but do not contact the server.
- Run `npx zooid deploy` after making changes to sync roles to the server.
- Scope format: `admin`, `pub:<channel>`, `sub:<channel>`. Wildcards supported: `pub:*`, `sub:prefix-*`.
