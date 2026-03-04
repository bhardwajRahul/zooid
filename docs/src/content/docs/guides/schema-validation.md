---
title: Schema Validation
description: Enforce event structure with JSON Schema
---

Channels can define JSON Schema for their event types. When strict mode is enabled, the server rejects events that do not conform to the schema.

## Defining a Schema

A schema file maps event type names to JSON Schema definitions:

```json
{
  "odds_shift": {
    "type": "object",
    "properties": {
      "market": { "type": "string" },
      "shift": { "type": "number" }
    },
    "required": ["market", "shift"]
  },
  "market_close": {
    "type": "object",
    "properties": {
      "market": { "type": "string" },
      "final_odds": { "type": "number" },
      "resolved": { "type": "boolean" }
    },
    "required": ["market", "final_odds"]
  }
}
```

Each key is an event type name. The value is a standard JSON Schema object that validates the event's `data` field.

## Creating a Channel with a Schema

```bash
npx zooid channel create market-signals --public --schema ./schema.json
```

By default, the schema is informational only. Events that do not match the schema are still accepted. The schema is published in the channel metadata so consumers know what to expect.

## Strict Mode

Add the `--strict` flag to enforce the schema on publish:

```bash
npx zooid channel create market-signals --public --schema ./schema.json --strict
```

With strict mode enabled:

- Events with a `type` that matches a schema key are validated against that schema
- Events that fail validation are rejected with `422 Unprocessable Entity` and a response body containing the validation errors
- Events without a `type` field bypass schema validation entirely

### Validation Error Response

```json
{
  "error": "schema_validation_failed",
  "message": "Event data does not match schema for type 'odds_shift'",
  "details": [
    {
      "path": "/shift",
      "message": "must be number"
    }
  ]
}
```

## Updating a Schema

Replace the schema on an existing channel:

```bash
npx zooid channel update market-signals --schema ./new-schema.json
```

This replaces the entire schema. There is no merging -- if you remove a type from the new schema file, that type is no longer validated even in strict mode.

### Enabling Strict Mode on an Existing Channel

```bash
npx zooid channel update market-signals --strict
```

### Disabling Strict Mode

```bash
npx zooid channel update market-signals --no-strict
```

## Events Without a Type

Events published without a `type` field are never validated, even in strict mode. This allows channels to accept untyped events alongside typed, validated ones.

If you want to require every event to have a type, enforce that at the application level.

## Schema Storage

The schema is stored in the channel's `config.types` field in the database. You can inspect it via the channel detail endpoint:

```bash
curl https://your-server.workers.dev/api/v1/channels/market-signals
```

```json
{
  "id": "market-signals",
  "name": "Market Signals",
  "public": true,
  "strict": true,
  "config": {
    "types": {
      "odds_shift": {
        "type": "object",
        "properties": {
          "market": { "type": "string" },
          "shift": { "type": "number" }
        },
        "required": ["market", "shift"]
      }
    }
  }
}
```

## Recommendations

- Define schemas early, even without strict mode. They serve as documentation for consumers.
- Enable strict mode for channels where data integrity matters (e.g., financial signals, structured alerts).
- Use `required` fields liberally to catch missing data at publish time.
- Keep schemas focused. Each event type should validate only its own `data` payload.
