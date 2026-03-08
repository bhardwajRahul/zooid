---
editUrl: false
next: false
prev: false
title: 'MintTokenOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:77](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L77)

Options for minting a new token via `POST /api/v1/tokens`.

## Properties

### expires_in?

> `optional` **expires_in**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:85](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L85)

Token expiry duration (e.g. `"5m"`, `"1h"`, `"7d"`, `"30d"`).

---

### name?

> `optional` **name**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:83](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L83)

Display name (used for publisher identity).

---

### scopes

> **scopes**: `string`[]

Defined in: [Code/zooid/packages/sdk/src/types.ts:79](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L79)

Scopes: ["admin"], ["pub:channel-id", "sub:channel-id"], etc.

---

### sub?

> `optional` **sub**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:81](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/sdk/src/types.ts#L81)

Subject identifier (e.g. publisher ID).
