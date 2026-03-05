---
editUrl: false
next: false
prev: false
title: 'SubscribeOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:130](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L130)

Options for the subscribe helper.

## Properties

### interval?

> `optional` **interval**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:132](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L132)

Polling interval in milliseconds. Default: `5000`.

---

### mode?

> `optional` **mode**: [`SubscribeMode`](/docs/reference/sdk/type-aliases/subscribemode/)

Defined in: [Code/zooid/packages/sdk/src/types.ts:134](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L134)

Transport mode. `'auto'` (default) tries WebSocket first, falls back to polling.

---

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:136](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L136)

Event type filter — passed as `?types=` on WS, `?type=` on poll.
