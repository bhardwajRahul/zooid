---
editUrl: false
next: false
prev: false
title: 'TailOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:140](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L140)

Options for the `tail()` method. Extends poll options with follow mode.

## Extends

- [`PollOptions`](/docs/reference/sdk/interfaces/polloptions/)

## Properties

### cursor?

> `optional` **cursor**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:109](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L109)

Opaque cursor from a previous poll response.

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`cursor`](/docs/reference/sdk/interfaces/polloptions/#cursor)

---

### follow?

> `optional` **follow**: `boolean`

Defined in: [Code/zooid/packages/sdk/src/types.ts:142](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L142)

When `true`, subscribe and stream events as they arrive.

---

### interval?

> `optional` **interval**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:146](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L146)

Polling interval in ms for follow mode (poll transport). Default: `5000`.

---

### limit?

> `optional` **limit**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:113](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L113)

Maximum number of events to return (default: 50).

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`limit`](/docs/reference/sdk/interfaces/polloptions/#limit)

---

### mode?

> `optional` **mode**: [`SubscribeMode`](/docs/reference/sdk/type-aliases/subscribemode/)

Defined in: [Code/zooid/packages/sdk/src/types.ts:144](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L144)

Transport mode for follow mode. Default: `'auto'`.

---

### since?

> `optional` **since**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:111](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L111)

ISO 8601 timestamp — only return events created after this time.

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`since`](/docs/reference/sdk/interfaces/polloptions/#since)

---

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:115](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L115)

Filter events by type.

#### Inherited from

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/).[`type`](/docs/reference/sdk/interfaces/polloptions/#type)
