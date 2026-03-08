---
editUrl: false
next: false
prev: false
title: "CreateChannelOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:41](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L41)

Options for creating a new channel via `POST /api/v1/channels`.

## Properties

### config?

> `optional` **config**: `Record`\<`string`, `unknown`\>

Defined in: [Code/zooid/packages/sdk/src/types.ts:51](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L51)

Optional channel config (types, storage, strict_types).

***

### description?

> `optional` **description**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:47](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L47)

Optional channel description.

***

### id

> **id**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:43](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L43)

URL-safe slug identifier (lowercase + hyphens, 3-64 chars).

***

### is\_public?

> `optional` **is\_public**: `boolean`

Defined in: [Code/zooid/packages/sdk/src/types.ts:49](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L49)

Whether the channel is publicly accessible. Defaults to `true`.

***

### name

> **name**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:45](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L45)

Human-readable display name.
