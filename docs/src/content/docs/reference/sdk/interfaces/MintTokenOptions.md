---
editUrl: false
next: false
prev: false
title: 'MintTokenOptions'
---

Defined in: [Code/zooid/packages/sdk/src/types.ts:81](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L81)

Options for minting a new token via `POST /api/v1/tokens`.

## Properties

### expires_in?

> `optional` **expires_in**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:89](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L89)

Token expiry duration (e.g. `"5m"`, `"1h"`, `"7d"`, `"30d"`).

---

### name?

> `optional` **name**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:87](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L87)

Display name (used for publisher identity).

---

### scopes

> **scopes**: `string`[]

Defined in: [Code/zooid/packages/sdk/src/types.ts:83](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L83)

Scopes: ["admin"], ["pub:channel-id", "sub:channel-id"], etc.

---

### sub?

> `optional` **sub**: `string`

Defined in: [Code/zooid/packages/sdk/src/types.ts:85](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/sdk/src/types.ts#L85)

Subject identifier (e.g. publisher ID).
