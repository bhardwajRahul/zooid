---
title: zooid login
description: Authenticate with Zoon or a specific Zooid server
---

Authenticates the CLI with a Zooid server. For Zoon-hosted servers, this uses a device code flow that opens your browser. For self-hosted servers with OIDC configured, it uses the server's own auth flow.

## Usage

```bash
npx zooid login [url]
```

## Arguments

| Argument | Description                                                |
| -------- | ---------------------------------------------------------- |
| `url`    | Server URL (optional). Omit to authenticate with Zoon.     |

## Options

None.

## Examples

```bash
# Authenticate with Zoon platform
npx zooid login

# Authenticate with a specific Zoon-hosted server
npx zooid login https://beno.zoon.eco

# Authenticate with a self-hosted server
npx zooid login https://my-zooid.workers.dev
```

## How it works

### Zoon-hosted servers

1. The CLI starts a device code flow with the Zoon accounts service
2. Your browser opens to a login page
3. You authenticate and authorize the CLI
4. The CLI polls for completion and stores two tokens:
   - **Zooid JWT** — for tenant server operations (publish, subscribe, channel management)
   - **Platform session** — for Zoon platform operations (credentials, deploy)

### Self-hosted servers

1. The CLI opens the server's OIDC login URL in your browser
2. You authenticate with the configured OIDC provider
3. The server mints a Zooid JWT and the CLI stores it

## Notes

- Tokens are stored in `~/.zooid/state.json` under the server URL.
- The CLI automatically refreshes tokens near expiry before each command.
- Run `zooid whoami` to verify your identity after logging in.
