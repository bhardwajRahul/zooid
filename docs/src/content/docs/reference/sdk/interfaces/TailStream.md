---
editUrl: false
next: false
prev: false
title: "TailStream"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:149](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L149)

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

Defined in: [Code/zooid/packages/sdk/src/types.ts:151](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/types.ts#L151)

Stop the subscription and end the stream.

#### Returns

`void`
