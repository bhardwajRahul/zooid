---
editUrl: false
next: false
prev: false
title: "MintTokenOptions"
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:83](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L83)

Options for minting a new token via `POST /api/v1/tokens`.

## Properties

### channels?

> `optional` **channels**: `string`[]

Defined in: [Code/zooid/packages/sdk/src/types.ts:87](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L87)

Channels this token grants access to (required for publish/subscribe).

***

### expires\_in?

> `optional` **expires\_in**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:93](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L93)

Token expiry duration (e.g. `"5m"`, `"1h"`, `"7d"`, `"30d"`).

***

### name?

> `optional` **name**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:91](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L91)

Display name (used for publisher identity).

***

### scope

> **scope**: `"admin"` \| `"publish"` \| `"subscribe"`

Defined in: [Code/zooid/packages/sdk/src/types.ts:85](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L85)

Token scope: what the token can do.

***

### sub?

> `optional` **sub**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:89](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/sdk/src/types.ts#L89)

Subject identifier (e.g. publisher ID).
