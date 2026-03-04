---
editUrl: false
next: false
prev: false
title: "PollOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:111](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L111)

Options for polling events from a channel.

## Extended by

- [`TailOptions`](/docs/reference/sdk/interfaces/tailoptions/)

## Properties

### cursor?

> `optional` **cursor**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:113](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L113)

Opaque cursor from a previous poll response.

***

### limit?

> `optional` **limit**: `number`

Defined in: [Code/zooid/packages/sdk/src/types.ts:117](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L117)

Maximum number of events to return (default: 50).

***

### since?

> `optional` **since**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:115](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L115)

ISO 8601 timestamp — only return events created after this time.

***

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:119](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L119)

Filter events by type.
