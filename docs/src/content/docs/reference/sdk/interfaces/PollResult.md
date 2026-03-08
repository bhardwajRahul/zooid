---
editUrl: false
next: false
prev: false
title: "PollResult"
---

Defined in: [Code/zooid/packages/types/src/index.ts:30](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L30)

Cursor-paginated poll response.

Returned by `GET /api/v1/channels/:id/events`. Use `cursor` in subsequent
requests to fetch the next page.

## Properties

### cursor

> **cursor**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:34](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L34)

Opaque cursor for the next page, or `null` if no more events.

***

### events

> **events**: [`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/)[]

Defined in: [Code/zooid/packages/types/src/index.ts:32](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L32)

Array of events in this page, ordered by ID ascending.

***

### has\_more

> **has\_more**: `boolean`

Defined in: [Code/zooid/packages/types/src/index.ts:36](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L36)

`true` if there are additional events beyond this page.
