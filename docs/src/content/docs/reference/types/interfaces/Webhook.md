---
editUrl: false
next: false
prev: false
title: 'Webhook'
---

Defined in: [index.ts:70](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L70)

A registered webhook subscription.

Webhooks receive POST requests for each new event published
to the subscribed channel.

## Properties

### channel_id

> **channel_id**: `string`

Defined in: [index.ts:74](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L74)

Channel this webhook is subscribed to.

---

### created_at

> **created_at**: `string`

Defined in: [index.ts:82](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L82)

ISO 8601 timestamp when this webhook was created.

---

### event_types

> **event_types**: `string` \| `null`

Defined in: [index.ts:78](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L78)

JSON-encoded array of event types to filter, or `null` for all events.

---

### expires_at

> **expires_at**: `string`

Defined in: [index.ts:80](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L80)

ISO 8601 timestamp when this webhook expires.

---

### id

> **id**: `string`

Defined in: [index.ts:72](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L72)

ULID identifier for this webhook registration.

---

### url

> **url**: `string`

Defined in: [index.ts:76](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L76)

URL that receives event POST requests.
