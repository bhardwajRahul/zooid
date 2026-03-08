---
editUrl: false
next: false
prev: false
title: 'ZooidError'
---

Defined in: [Code/zooid/packages/sdk/src/error.ts:7](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/error.ts#L7)

Error thrown by [ZooidClient](/docs/reference/sdk/classes/zooidclient/) when the server returns a non-2xx response.

The `status` property contains the HTTP status code, and `message` contains
the error description from the response body (or a fallback like `"HTTP 500"`).

## Extends

- `Error`

## Constructors

### Constructor

> **new ZooidError**(`status`, `message`): `ZooidError`

Defined in: [Code/zooid/packages/sdk/src/error.ts:11](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/error.ts#L11)

#### Parameters

##### status

`number`

##### message

`string`

#### Returns

`ZooidError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

Defined in: Code/zooid/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es2022.error.d.ts:26

#### Inherited from

`Error.cause`

---

### message

> **message**: `string`

Defined in: Code/zooid/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1077

#### Inherited from

`Error.message`

---

### name

> **name**: `string`

Defined in: Code/zooid/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1076

#### Inherited from

`Error.name`

---

### stack?

> `optional` **stack**: `string`

Defined in: Code/zooid/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/lib.es5.d.ts:1078

#### Inherited from

`Error.stack`

---

### status

> **status**: `number`

Defined in: [Code/zooid/packages/sdk/src/error.ts:9](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/error.ts#L9)

HTTP status code from the server response.

---

### prepareStackTrace()?

> `static` `optional` **prepareStackTrace**: (`err`, `stackTraces`) => `any`

Defined in: node_modules/@types/node/globals.d.ts:11

Optional override for formatting stack traces

#### Parameters

##### err

`Error`

##### stackTraces

`CallSite`[]

#### Returns

`any`

#### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

#### Inherited from

`Error.prepareStackTrace`

---

### stackTraceLimit

> `static` **stackTraceLimit**: `number`

Defined in: node_modules/@types/node/globals.d.ts:13

#### Inherited from

`Error.stackTraceLimit`

## Methods

### captureStackTrace()

> `static` **captureStackTrace**(`targetObject`, `constructorOpt?`): `void`

Defined in: node_modules/@types/node/globals.d.ts:4

Create .stack property on a target object

#### Parameters

##### targetObject

`object`

##### constructorOpt?

`Function`

#### Returns

`void`

#### Inherited from

`Error.captureStackTrace`
