---
editUrl: false
next: false
prev: false
title: 'TailStream'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:153](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L153)

An async iterable stream of events returned by `tail({ follow: true })`.
Call `close()` to stop the underlying subscription and end the stream.

## Extends

- `AsyncIterable`\<`ZooidEvent`\>

## Methods

### \[asyncIterator\]()

> **\[asyncIterator\]**(): `AsyncIterator`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/), `any`, `any`\>

Defined in: Code/zooid/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es2018.asynciterable.d.ts:38

#### Returns

`AsyncIterator`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/), `any`, `any`\>

#### Inherited from

`AsyncIterable.[asyncIterator]`

---

### close()

> **close**(): `void`

Defined in: [Code/zooid/packages/sdk/src/types.ts:155](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L155)

Stop the subscription and end the stream.

#### Returns

`void`
