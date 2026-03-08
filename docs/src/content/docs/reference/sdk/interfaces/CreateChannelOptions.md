---
editUrl: false
next: false
prev: false
title: 'CreateChannelOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:41](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L41)

Options for creating a new channel via `POST /api/v1/channels`.

## Properties

### config?

> `optional` **config**: `Record`\<`string`, `unknown`\>

Defined in: [Code/zooid/packages/sdk/src/types.ts:51](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L51)

Optional channel config (types, storage, strict_types).

---

### description?

> `optional` **description**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:47](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L47)

Optional channel description.

---

### id

> **id**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:43](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L43)

URL-safe slug identifier (lowercase + hyphens, 3-64 chars).

---

### is_public?

> `optional` **is_public**: `boolean`

Defined in: [Code/zooid/packages/sdk/src/types.ts:49](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L49)

Whether the channel is publicly accessible. Defaults to `true`.

---

### name

> **name**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:45](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/types.ts#L45)

Human-readable display name.
