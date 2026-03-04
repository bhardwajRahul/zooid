---
editUrl: false
next: false
prev: false
title: "ZooidEvent"
---

Defined in: [index.ts:7](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L7)

A published event as returned by the API.

Events are the core unit of data in Zooid. Each event belongs to a channel
and is identified by a time-ordered ULID.

## Properties

### channel\_id

> **channel\_id**: `string`

Defined in: [index.ts:11](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L11)

The channel this event was published to.

***

### created\_at

> **created\_at**: `string`

Defined in: [index.ts:21](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L21)

ISO 8601 timestamp when the event was created.

***

### data

> **data**: `string`

Defined in: [index.ts:19](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L19)

JSON-serialized event payload (max 64 KB).

***

### id

> **id**: `string`

Defined in: [index.ts:9](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L9)

Time-ordered ULID that uniquely identifies this event.

***

### publisher\_id

> **publisher\_id**: `string` \| `null`

Defined in: [index.ts:13](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L13)

ID of the publisher that created this event, or `null` for admin publishes.

***

### publisher\_name

> **publisher\_name**: `string` \| `null`

Defined in: [index.ts:15](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L15)

Display name of the publisher, or `null` if not provided.

***

### type

> **type**: `string` \| `null`

Defined in: [index.ts:17](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L17)

Optional event type string for filtering (e.g. `"trade"`, `"alert"`).
