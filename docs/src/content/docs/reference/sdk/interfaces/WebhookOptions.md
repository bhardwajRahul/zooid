---
editUrl: false
next: false
prev: false
title: "WebhookOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:115](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L115)

Options for registering a webhook.

## Properties

### event\_types?

> `optional` **event\_types**: `string`[]

Defined in: [Code/zooid/packages/sdk/src/types.ts:117](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L117)

Only deliver events matching these types. Omit for all events.

***

### ttl\_seconds?

> `optional` **ttl\_seconds**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:119](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L119)

Webhook lifetime in seconds (default: 3 days, max: 30 days).
