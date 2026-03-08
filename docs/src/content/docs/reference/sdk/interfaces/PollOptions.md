---
editUrl: false
next: false
prev: false
title: 'PollOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:103](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L103)

Options for polling events from a channel.

## Extended by

- [`TailOptions`](/docs/reference/sdk/interfaces/tailoptions/)

## Properties

### cursor?

> `optional` **cursor**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:105](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L105)

Opaque cursor from a previous poll response.

---

### limit?

> `optional` **limit**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:109](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L109)

Maximum number of events to return (default: 50).

---

### since?

> `optional` **since**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:107](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L107)

ISO 8601 timestamp — only return events created after this time.

---

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:111](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L111)

Filter events by type.
