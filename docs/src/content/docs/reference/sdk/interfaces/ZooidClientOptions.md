---
editUrl: false
next: false
prev: false
title: 'ZooidClientOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:31](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L31)

Options for constructing a [ZooidClient](/docs/reference/sdk/classes/zooidclient/).

## Properties

### fetch()?

> `optional` **fetch**: (`input`, `init?`) => `Promise`\<`Response`\>

Defined in: [Code/zooid/packages/sdk/src/types.ts:37](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L37)

Custom fetch implementation (for testing or custom environments).

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

#### Parameters

##### input

`RequestInfo` | `URL`

##### init?

`RequestInit`

#### Returns

`Promise`\<`Response`\>

---

### server

> **server**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:33](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L33)

Base URL of the Zooid server (e.g. `"https://zooid.example.workers.dev"`).

---

### token?

> `optional` **token**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:35](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L35)

JWT token (admin, publish, or subscribe scoped).
