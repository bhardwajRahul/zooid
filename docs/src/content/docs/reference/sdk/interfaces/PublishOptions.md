---
editUrl: false
next: false
prev: false
title: 'PublishOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:95](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L95)

Options for publishing a single event.

## Properties

### data

> **data**: `unknown`

Defined in: [Code/zooid/packages/sdk/src/types.ts:99](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L99)

Event payload (will be JSON-serialized, max 64 KB).

---

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:97](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L97)

Optional event type string for subscriber filtering.
