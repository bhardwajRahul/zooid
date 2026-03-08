---
editUrl: false
next: false
prev: false
title: 'WebhookOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:115](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L115)

Options for registering a webhook.

## Properties

### event_types?

> `optional` **event_types**: `string`[]

Defined in: [Code/zooid/packages/sdk/src/types.ts:117](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L117)

Only deliver events matching these types. Omit for all events.

---

### ttl_seconds?

> `optional` **ttl_seconds**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:119](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L119)

Webhook lifetime in seconds (default: 3 days, max: 30 days).
