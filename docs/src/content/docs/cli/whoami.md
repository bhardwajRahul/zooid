---
title: zooid whoami
description: Show current identity and auth status
---

Displays the current authenticated user, server, scopes, and token expiry.

## Usage

```bash
npx zooid whoami
```

## Arguments

None.

## Options

None.

## Examples

```bash
npx zooid whoami
# Server: https://beno.zoon.eco
# User: ori
# Scopes: admin
# Auth: oidc (expires 2026-03-22T10:30:00.000Z)
```

## Notes

- Shows the decoded JWT claims from your stored token.
- If the token is expired, `zooid whoami` will attempt to refresh it first.
