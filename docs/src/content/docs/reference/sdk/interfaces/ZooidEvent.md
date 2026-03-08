---
editUrl: false
next: false
prev: false
title: 'ZooidEvent'
---

Defined in: [Code/zooid/packages/types/src/index.ts:7](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L7)

A published event as returned by the API.

Events are the core unit of data in Zooid. Each event belongs to a channel
and is identified by a time-ordered ULID.

## Properties

### channel_id

> **channel_id**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:11](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L11)

The channel this event was published to.

---

### created_at

> **created_at**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:21](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L21)

ISO 8601 timestamp when the event was created.

---

### data

> **data**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:19](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L19)

JSON-serialized event payload (max 64 KB).

---

### id

> **id**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:9](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L9)

Time-ordered ULID that uniquely identifies this event.

---

### publisher_id

> **publisher_id**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:13](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L13)

ID of the publisher that created this event, or `null` for admin publishes.

---

### publisher_name

> **publisher_name**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:15](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L15)

Display name of the publisher, or `null` if not provided.

---

### type

> **type**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:17](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L17)

Optional event type string for filtering (e.g. `"trade"`, `"alert"`).
