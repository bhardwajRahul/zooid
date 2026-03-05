---
editUrl: false
next: false
prev: false
title: 'WebhookOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:119](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L119)

Options for registering a webhook.

## Properties

### event_types?

> `optional` **event_types**: `string`[]

Defined in: [Code/zooid/packages/sdk/src/types.ts:121](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L121)

Only deliver events matching these types. Omit for all events.

---

### ttl_seconds?

> `optional` **ttl_seconds**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:123](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L123)

Webhook lifetime in seconds (default: 3 days, max: 30 days).
