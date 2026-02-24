# n8n-nodes-zooid

n8n community node for [Zooid](https://zooid.dev) — connect any SaaS trigger to AI agents via pub/sub channels.

Zooid is an open-source pub/sub server for AI agents. SaaS events go in via n8n, agents subscribe and react. This node handles the publishing side.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation) | [Credentials](#credentials) | [Operations](#operations) | [Schema-Aware Publishing](#schema-aware-publishing) | [Examples](#examples) | [Resources](#resources)

## Installation

In the n8n UI: **Settings > Community Nodes > Install** > enter `n8n-nodes-zooid`.

Or follow the [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. Add a **Zooid API** credential in n8n.
2. **Server URL** — your Zooid instance (e.g. `https://your-instance.workers.dev`).
3. **Token** — a publish or admin JWT.

The test button pings `/.well-known/zooid.json` to verify the server is reachable.

### Getting a token

```bash

# Deploy zooid to Cloudflare (if you haven't yet)
npx zooid init
npx zooid deploy

# Create a channel — returns publish + subscribe tokens
npx zooid channel create my-channel --public --name "My Channel"

# Or add a named publisher to an existing channel
npx zooid channel add-publisher my-channel --name "n8n"
```

An **admin token** lets the node load channel and event type dropdowns. A **publish token** is channel-scoped — use it for least-privilege setups.

## Operations

### Event > Publish

Publish a JSON event to a Zooid channel.

| Field | Description |
|-------|-------------|
| **Channel** | Select from a dropdown (loaded from the server) or type an ID manually. |
| **Event Type** | Select from the channel's schema types, or type a custom string. |
| **Input Mode** | Choose between **Form Fields** (schema-generated) or **Raw JSON**. |
| **Event Fields** | Auto-generated form fields when the channel has a schema. |
| **Event Data** | Raw JSON editor (max 64KB) for schemaless channels or complex nested data. |

### Channel > Get Many

List all channels on the Zooid server. Returns channel ID, name, description, event count, schema, and strict mode status.

## Schema-Aware Publishing

Zooid channels can define JSON schemas per event type. When a channel has a schema, this node generates form fields automatically:

1. **Select a channel** — the dropdown loads channels from your server.
2. **Pick an event type** — types are loaded from the channel's schema keys (e.g. `alert`, `metric`, `task-created`).
3. **Fill in form fields** — fields are generated with correct types (string, number, boolean, date), required markers, and defaults.
4. **Strict enforcement** — channels with `strict: true` reject events that don't match the schema. The node shows a notice when this is active.

For channels without schemas, switch to **Raw JSON** mode and paste or build the payload with n8n expressions.

### Schema structure

Zooid schemas map event types to JSON Schema definitions:

```json
{
  "alert": {
    "type": "object",
    "required": ["level", "message"],
    "properties": {
      "level": { "type": "string", "enum": ["info", "warning", "critical"] },
      "message": { "type": "string" }
    }
  },
  "metric": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "value": { "type": "number" }
    }
  }
}
```

Each key becomes a selectable event type in the node's dropdown.

## Examples

### SaaS trigger to AI agent

The two-line demo — wire any SaaS event to an AI agent:

```
n8n:  [ClickUp Trigger] → [Zooid: Publish Event] → done
```

```bash
npx zooid tail -f clickup-tasks | claude -p "Review this task and post a summary"
```

### Fan-out to multiple agents

Publish once, multiple agents subscribe independently:

```
n8n:  [GitHub Trigger] → [Zooid: Publish to "github-events"]
```

```bash
# Agent 1: Security reviewer
npx zooid tail -f github-events --type pr-opened | claude -p "Review for security issues"

# Agent 2: Changelog writer
npx zooid tail -f github-events --type release | claude -p "Write a changelog entry"

# Agent 3: Slack notifier (another n8n workflow subscribing to the same channel)
```

### Manual testing

1. Add a **Manual Trigger** node.
2. Connect a **Zooid** node, select your channel.
3. Set input mode to **Raw JSON**, enter `{"hello": "world"}`.
4. Click **Test Workflow**.
5. Verify with `npx zooid tail your-channel --limit 1`.

## Compatibility

Tested with n8n 1.71+.

## Development

```bash
# Install dependencies
pnpm install

# Start n8n with the node loaded (hot-reload)
pnpm run dev

# Build
pnpm run build

# Lint (n8n-specific rules)
pnpm run lint
```

## Resources

- [Zooid documentation](https://zooid.dev/docs)
- [Zooid GitHub](https://github.com/zooid-ai/zooid)
- [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/installation/)
