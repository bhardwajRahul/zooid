---
editUrl: false
next: false
prev: false
title: "SubscribeOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:134](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L134)

Options for the subscribe helper.

## Properties

### interval?

> `optional` **interval**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:136](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L136)

Polling interval in milliseconds. Default: `5000`.

***

### mode?

> `optional` **mode**: [`SubscribeMode`](/docs/reference/sdk/type-aliases/subscribemode/)

Defined in: [Code/zooid/packages/sdk/src/types.ts:138](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L138)

Transport mode. `'auto'` (default) tries WebSocket first, falls back to polling.

***

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:140](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L140)

Event type filter — passed as `?types=` on WS, `?type=` on poll.
