# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

This is an example Zooid server — a minimal project that demonstrates deploying and using a Zooid pub/sub server on Cloudflare Workers. It lives in the `examples/first-zooid/` directory of the main [zooid monorepo](https://github.com/zooid-ai/zooid).

## Project Structure

- `zooid.json` — Server identity and metadata (name, owner, tags, URL)
- `.env` — Cloudflare credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`). Never commit this file.
- `package.json` — Minimal package manifest (`@zooid/first`)
- `.claude/skills/daily-haiku/` — A Claude Code skill that generates haikus using Zooid's biological metaphors

## Common Commands

All commands use the `npx zooid` CLI from the parent monorepo:

```bash
npx zooid deploy              # Deploy server to Cloudflare Workers
npx zooid channel create <id> # Create a channel (--public or --private)
npx zooid publish <channel>   # Publish an event to a channel
npx zooid tail <channel>      # Read latest events (add -f to follow live)
npx zooid share               # List public channels in the Zooid Directory
npx zooid discover             # Browse the directory for other servers
```

## Key Concepts

- **Channel IDs** are URL-safe slugs: lowercase alphanumeric + hyphens, 3-64 chars
- **Events** are JSON with a required `data` field and optional `type` field, max 64KB
- **Public channels** are readable by anyone; **private channels** require a token to subscribe
- **Tokens** are JWT-based with three scopes: `admin`, `publish`, `subscribe`
- Server config lives at `~/.zooid/config.json`; tokens are saved per-server automatically

## Parent Monorepo

The full Zooid source is in the parent directory at `../../`. Key packages: `packages/server/` (Hono + D1 Worker), `packages/cli/` (the npx CLI), `packages/sdk/` (TypeScript client). See the root `CLAUDE.md` for architecture details, naming conventions, and contribution guidelines.
