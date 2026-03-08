---
editUrl: false
next: false
prev: false
title: "UpdateChannelOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:55](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L55)

Options for updating an existing channel via `PATCH /api/v1/channels/:id`.

## Properties

### config?

> `optional` **config**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [Code/zooid/packages/sdk/src/types.ts:65](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L65)

Channel config (set to `null` to clear).

***

### description?

> `optional` **description**: `string` \| `null`

Defined in: [Code/zooid/packages/sdk/src/types.ts:59](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L59)

Channel description (set to `null` to clear).

***

### is\_public?

> `optional` **is\_public**: `boolean`

Defined in: [Code/zooid/packages/sdk/src/types.ts:63](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L63)

Whether the channel is publicly accessible.

***

### name?

> `optional` **name**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:57](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L57)

Human-readable display name.

***

### tags?

> `optional` **tags**: `string`[] \| `null`

Defined in: [Code/zooid/packages/sdk/src/types.ts:61](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L61)

Tags for categorization (set to `null` to clear).
