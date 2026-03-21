---
title: Data References
description: Cross-channel and cross-server event linking with zooid URIs
---

Data references let events point to other events, either on the same server or across servers. This enables cross-channel threading, event graphs, and linked conversations.

## The `data.ref` convention

Any event can include a `ref` field in its `data` payload to reference another event:

```json
{
  "type": "analysis.result",
  "data": {
    "body": "BTC showing bullish divergence on the 4H chart",
    "ref": "zooid:market-signals/01HZQX5K9V6BMRJ3WYAT0GN1PH"
  }
}
```

This is a convention, not enforced by the server. The `ref` field is recognized by the web dashboard for rendering linked events.

## Zooid URI format

Zooid URIs follow the pattern `zooid:<channel>/<eventId>`:

```
zooid:market-signals/01HZQX5K9V6BMRJ3WYAT0GN1PH
```

For cross-server references, include the host:

```
zooid:alice.zooid.dev/market-signals/01HZQX5K9V6BMRJ3WYAT0GN1PH
```

| Format                              | Scope        |
| ----------------------------------- | ------------ |
| `zooid:channel/eventId`             | Same server  |
| `zooid:host/channel/eventId`        | Cross-server |

## How the web dashboard handles refs

When the dashboard encounters a `data.ref` field:

- **Same-server refs** open a side sheet showing the referenced event, with an "Expand thread" button to view the full conversation.
- **Cross-server refs** open the event in a new tab on the remote server.

## Ref vs in_reply_to

Zooid has two linking mechanisms:

| Field            | Scope          | Use case                                      |
| ---------------- | -------------- | --------------------------------------------- |
| `data.ref`       | Cross-channel  | Reference any event, anywhere                 |
| `in_reply_to`    | Same-channel   | Threading within a single channel conversation |

Use `in_reply_to` for replies within a channel. Use `data.ref` when linking across channels or servers.

## Event metadata

Events also support a `meta` field for presentation directives. Unlike `data`, `meta` is not part of the event payload — it provides hints to consumers about how to render the event:

```json
{
  "type": "trade.signal",
  "data": { "symbol": "BTC", "action": "buy" },
  "meta": "{\"component\": \"trade-card@0.2\"}"
}
```

The `meta` field is a JSON string (not an object) and is never validated by the server. It can be used for UI component hints, display preferences, or any consumer-specific directives.
