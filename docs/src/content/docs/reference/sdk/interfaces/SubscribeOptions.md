---
editUrl: false
next: false
prev: false
title: "SubscribeOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:126](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L126)

Options for the subscribe helper.

## Properties

### interval?

> `optional` **interval**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:128](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L128)

Polling interval in milliseconds. Default: `5000`.

***

### mode?

> `optional` **mode**: [`SubscribeMode`](/docs/reference/sdk/type-aliases/subscribemode/)

Defined in: [Code/zooid/packages/sdk/src/types.ts:130](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L130)

Transport mode. `'auto'` (default) tries WebSocket first, falls back to polling.

***

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:132](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L132)

Event type filter — passed as `?types=` on WS, `?type=` on poll.
