---
editUrl: false
next: false
prev: false
title: 'verifyWebhook'
---

> **verifyWebhook**(`options`): `Promise`\<`boolean`\>

Defined in: [Code/zooid/packages/sdk/src/verify.ts:31](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/sdk/src/verify.ts#L31)

Verify an Ed25519 webhook signature from a Zooid server.

## Parameters

### options

[`VerifyWebhookOptions`](/docs/reference/sdk/interfaces/verifywebhookoptions/)

## Returns

`Promise`\<`boolean`\>

## Example

```ts
import { verifyWebhook } from '@zooid/sdk';

const isValid = await verifyWebhook({
  body: rawBody,
  signature: req.headers['x-zooid-signature'],
  timestamp: req.headers['x-zooid-timestamp'],
  publicKey: cachedPublicKey,
  maxAge: 300,
});
```
