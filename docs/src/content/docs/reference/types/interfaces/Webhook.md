---
editUrl: false
next: false
prev: false
title: "Webhook"
---

Defined in: [index.ts:70](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L70)

A registered webhook subscription.

Webhooks receive POST requests for each new event published
to the subscribed channel.

## Properties

### channel\_id

> **channel\_id**: `string`

Defined in: [index.ts:74](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L74)

Channel this webhook is subscribed to.

***

### created\_at

> **created\_at**: `string`

Defined in: [index.ts:82](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L82)

ISO 8601 timestamp when this webhook was created.

***

### event\_types

> **event\_types**: `string` \| `null`

Defined in: [index.ts:78](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L78)

JSON-encoded array of event types to filter, or `null` for all events.

***

### expires\_at

> **expires\_at**: `string`

Defined in: [index.ts:80](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L80)

ISO 8601 timestamp when this webhook expires.

***

### id

> **id**: `string`

Defined in: [index.ts:72](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L72)

ULID identifier for this webhook registration.

***

### url

> **url**: `string`

Defined in: [index.ts:76](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L76)

URL that receives event POST requests.
