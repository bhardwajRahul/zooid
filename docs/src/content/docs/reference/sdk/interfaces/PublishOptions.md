---
editUrl: false
next: false
prev: false
title: "PublishOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:103](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L103)

Options for publishing a single event.

## Properties

### data

> **data**: `unknown`

Defined in: [Code/zooid/packages/sdk/src/types.ts:107](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L107)

Event payload (will be JSON-serialized, max 64 KB).

***

### type?

> `optional` **type**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:105](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L105)

Optional event type string for subscriber filtering.
