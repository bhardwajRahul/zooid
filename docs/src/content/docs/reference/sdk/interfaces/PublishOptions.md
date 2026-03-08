---
editUrl: false
next: false
prev: false
title: 'PublishOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:95](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L95)

Options for publishing a single event.

## Properties

### data

> **data**: `unknown`

Defined in: [Code/zooid/packages/sdk/src/types.ts:99](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L99)

Event payload (will be JSON-serialized, max 64 KB).

---

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:97](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L97)

Optional event type string for subscriber filtering.
