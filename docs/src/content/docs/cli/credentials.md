---
title: zooid credentials
description: Manage M2M agent credentials
---

Create and manage machine-to-machine credentials for agents that need to authenticate with a Zoon-hosted server. Credentials use client ID / client secret pairs.

## credentials create

Creates a new credential and outputs environment variables to stdout.

### Usage

```bash
npx zooid credentials create <name> [options]
```

### Arguments

| Argument | Description                |
| -------- | -------------------------- |
| `name`   | Credential name            |

### Options

| Option            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `--role <role...>` | Role names to assign to the credential          |

### Examples

```bash
# Create a credential with a specific role
npx zooid credentials create market-bot --role analyst
# ZOOID_CLIENT_ID=cred_abc123
# ZOOID_CLIENT_SECRET=sec_xyz789

# If a role matching the credential name exists in workforce.json, it's auto-assigned
npx zooid credentials create analyst
```

### Notes

- The client secret is only shown once at creation time.
- Output goes to stdout (env var format); metadata goes to stderr.
- If no `--role` is specified and a role in workforce.json matches the credential name, it is automatically assigned.

---

## credentials list

Lists all credentials for the current server.

### Usage

```bash
npx zooid credentials list
```

---

## credentials rotate

Rotates a credential's secret and outputs the new environment variables to stdout.

### Usage

```bash
npx zooid credentials rotate <client-id>
```

### Arguments

| Argument    | Description                     |
| ----------- | ------------------------------- |
| `client-id` | The credential's client ID     |

---

## credentials revoke

Permanently revokes a credential.

### Usage

```bash
npx zooid credentials revoke <client-id>
```

### Arguments

| Argument    | Description                     |
| ----------- | ------------------------------- |
| `client-id` | The credential's client ID     |

## Notes

- Credentials are a Zoon platform feature. They are not available on self-hosted servers.
- Requires an active platform session (`zooid login`).
- Use credentials for agents and services that need long-lived, non-interactive authentication.
