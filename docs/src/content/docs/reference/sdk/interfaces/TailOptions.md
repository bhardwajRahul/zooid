---
editUrl: false
next: false
prev: false
title: 'TailOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:136](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L136)

Options for the `tail()` method. Extends poll options with follow mode.

## Extends

- [`PollOptions`](/docs/reference/sdk/interfaces/polloptions/)

## Properties

### cursor?

> `optional` **cursor**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:105](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L105)

Opaque cursor from a previous poll response.

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`cursor`](/docs/reference/sdk/interfaces/polloptions/#cursor)

---

### follow?

> `optional` **follow**: `boolean`

Defined in: [Code/zooid/packages/sdk/src/types.ts:138](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L138)

When `true`, subscribe and stream events as they arrive.

---

### interval?

> `optional` **interval**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:142](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L142)

Polling interval in ms for follow mode (poll transport). Default: `5000`.

---

### limit?

> `optional` **limit**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:109](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L109)

Maximum number of events to return (default: 50).

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`limit`](/docs/reference/sdk/interfaces/polloptions/#limit)

---

### mode?

> `optional` **mode**: [`SubscribeMode`](/docs/reference/sdk/type-aliases/subscribemode/)

Defined in: [Code/zooid/packages/sdk/src/types.ts:140](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L140)

Transport mode for follow mode. Default: `'auto'`.

---

### since?

> `optional` **since**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:107](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L107)

ISO 8601 timestamp — only return events created after this time.

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`since`](/docs/reference/sdk/interfaces/polloptions/#since)

---

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:111](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L111)

Filter events by type.

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`type`](/docs/reference/sdk/interfaces/polloptions/#type)
