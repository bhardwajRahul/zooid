---
editUrl: false
next: false
prev: false
title: "TailStream"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:157](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L157)

An async iterable stream of events returned by `tail({ follow: true })`.
Call `close()` to stop the underlying subscription and end the stream.

## Extends

- `AsyncIterable`\<`ZooidEvent`\>

## Methods

### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/), `any`, `any`\>

Defined in: Code/zooid/node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es2018.asynciterable.d.ts:38

#### Returns

`AsyncIterator`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/), `any`, `any`\>

#### Inherited from

`AsyncIterable.[asyncIterator]`

***

### close()

> **close**(): `void`

Defined in: [Code/zooid/packages/sdk/src/types.ts:159](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L159)

Stop the subscription and end the stream.

#### Returns

`void`
