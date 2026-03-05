---
editUrl: false
next: false
prev: false
title: 'Webhook'
---

Defined in: [index.ts:72](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L72)

A registered webhook subscription.

Webhooks receive POST requests for each new event published
to the subscribed channel.

## Properties

### channel_id

> **channel_id**: `string`

Defined in: [index.ts:76](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L76)

Channel this webhook is subscribed to.

---

### created_at

> **created_at**: `string`

Defined in: [index.ts:84](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L84)

ISO 8601 timestamp when this webhook was created.

---

### event_types

> **event_types**: `string` \| `null`

Defined in: [index.ts:80](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L80)

JSON-encoded array of event types to filter, or `null` for all events.

---

### expires_at

> **expires_at**: `string`

Defined in: [index.ts:82](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L82)

ISO 8601 timestamp when this webhook expires.

---

### id

> **id**: `string`

Defined in: [index.ts:74](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L74)

ULID identifier for this webhook registration.

---

### url

> **url**: `string`

Defined in: [index.ts:78](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L78)

URL that receives event POST requests.
