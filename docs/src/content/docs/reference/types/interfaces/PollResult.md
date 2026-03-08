---
editUrl: false
next: false
prev: false
title: 'PollResult'
---

Defined in: [index.ts:30](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L30)

Cursor-paginated poll response.

Returned by `GET /api/v1/channels/:id/events`. Use `cursor` in subsequent
requests to fetch the next page.

## Properties

### cursor

> **cursor**: `string` \| `null`

Defined in: [index.ts:34](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L34)

Opaque cursor for the next page, or `null` if no more events.

---

### events

> **events**: [`ZooidEvent`](/docs/reference/types/interfaces/zooidevent/)[]

Defined in: [index.ts:32](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L32)

Array of events in this page, ordered by ID ascending.

---

### has_more

> **has_more**: `boolean`

Defined in: [index.ts:36](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L36)

`true` if there are additional events beyond this page.
