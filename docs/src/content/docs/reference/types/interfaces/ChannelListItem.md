---
editUrl: false
next: false
prev: false
title: "ChannelListItem"
---

Defined in: [index.ts:45](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L45)

Public channel listing returned by `GET /api/v1/channels`.

Includes aggregate stats (event count, publishers) alongside
the channel's configuration.

## Properties

### config

> **config**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [index.ts:57](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L57)

Optional channel config (types, storage, strict_types).

***

### description

> **description**: `string` \| `null`

Defined in: [index.ts:51](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L51)

Optional description of the channel's purpose.

***

### event\_count

> **event\_count**: `number`

Defined in: [index.ts:59](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L59)

Total number of events currently stored in this channel.

***

### id

> **id**: `string`

Defined in: [index.ts:47](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L47)

URL-safe slug identifier (lowercase + hyphens, 3-64 chars).

***

### is\_public

> **is\_public**: `boolean`

Defined in: [index.ts:55](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L55)

Whether the channel is publicly accessible without a token.

***

### last\_event\_at

> **last\_event\_at**: `string` \| `null`

Defined in: [index.ts:61](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L61)

ISO 8601 timestamp of the most recent event, or `null` if empty.

***

### name

> **name**: `string`

Defined in: [index.ts:49](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L49)

Human-readable display name.

***

### tags

> **tags**: `string`[]

Defined in: [index.ts:53](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L53)

Arbitrary tags for categorization.
