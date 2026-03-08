---
editUrl: false
next: false
prev: false
title: 'VerifyWebhookOptions'
---

Defined in: [Code/zooid/packages/sdk/src/verify.ts:2](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/verify.ts#L2)

Options for verifying a Zooid webhook signature.

## Properties

### body

> **body**: `string`

Defined in: [Code/zooid/packages/sdk/src/verify.ts:4](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/verify.ts#L4)

The raw JSON request body string.

---

### maxAge?

> `optional` **maxAge**: `number`

Defined in: [Code/zooid/packages/sdk/src/verify.ts:12](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/verify.ts#L12)

Maximum age in seconds before the timestamp is considered stale. Default: no check.

---

### publicKey

> **publicKey**: `string`

Defined in: [Code/zooid/packages/sdk/src/verify.ts:10](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/verify.ts#L10)

Base64-encoded SPKI public key from `/.well-known/zooid.json`.

---

### signature

> **signature**: `string`

Defined in: [Code/zooid/packages/sdk/src/verify.ts:6](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/verify.ts#L6)

Base64-encoded Ed25519 signature from the `X-Zooid-Signature` header.

---

### timestamp

> **timestamp**: `string`

Defined in: [Code/zooid/packages/sdk/src/verify.ts:8](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/verify.ts#L8)

ISO 8601 timestamp from the `X-Zooid-Timestamp` header.
