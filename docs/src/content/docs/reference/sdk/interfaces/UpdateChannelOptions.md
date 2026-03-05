---
editUrl: false
next: false
prev: false
title: 'UpdateChannelOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:57](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L57)

Options for updating an existing channel via `PATCH /api/v1/channels/:id`.

## Properties

### config?

> `optional` **config**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [Code/zooid/packages/sdk/src/types.ts:67](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L67)

Channel config (set to `null` to clear).

---

### description?

> `optional` **description**: `string` \| `null`

Defined in: [Code/zooid/packages/sdk/src/types.ts:61](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L61)

Channel description (set to `null` to clear).

---

### is_public?

> `optional` **is_public**: `boolean`

Defined in: [Code/zooid/packages/sdk/src/types.ts:65](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L65)

Whether the channel is publicly accessible.

---

### name?

> `optional` **name**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:59](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L59)

Human-readable display name.

---

### strict?

> `optional` **strict**: `boolean`

Defined in: [Code/zooid/packages/sdk/src/types.ts:69](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L69)

When `true`, events are rejected if they don't match `schema`.

---

### tags?

> `optional` **tags**: `string`[] \| `null`

Defined in: [Code/zooid/packages/sdk/src/types.ts:63](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L63)

Tags for categorization (set to `null` to clear).
