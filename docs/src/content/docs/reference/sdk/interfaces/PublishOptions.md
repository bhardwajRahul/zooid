---
editUrl: false
next: false
prev: false
title: 'PublishOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:99](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L99)

Options for publishing a single event.

## Properties

### data

> **data**: `unknown`

Defined in: [Code/zooid/packages/sdk/src/types.ts:103](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L103)

Event payload (will be JSON-serialized, max 64 KB).

---

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:101](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L101)

Optional event type string for subscriber filtering.
