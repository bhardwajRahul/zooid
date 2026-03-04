---
editUrl: false
next: false
prev: false
title: "WebhookOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:123](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L123)

Options for registering a webhook.

## Properties

### event\_types?

> `optional` **event\_types**: `string`[]

Defined in: [Code/zooid/packages/sdk/src/types.ts:125](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L125)

Only deliver events matching these types. Omit for all events.

***

### ttl\_seconds?

> `optional` **ttl\_seconds**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:127](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L127)

Webhook lifetime in seconds (default: 3 days, max: 30 days).
