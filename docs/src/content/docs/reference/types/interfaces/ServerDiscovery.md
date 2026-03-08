---
editUrl: false
next: false
prev: false
title: 'ServerDiscovery'
---

Defined in: [index.ts:92](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L92)

Server discovery metadata from `GET /.well-known/zooid.json`.

Contains the information needed by agents to discover and verify
a Zooid server: its public signing key, supported delivery mechanisms,
and recommended poll interval.

## Properties

### algorithm

> **algorithm**: `string`

Defined in: [index.ts:100](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L100)

Signing algorithm (e.g. `"Ed25519"`).

---

### delivery

> **delivery**: `string`[]

Defined in: [index.ts:106](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L106)

Supported delivery mechanisms (e.g. `["polling", "webhooks", "rss"]`).

---

### poll_interval

> **poll_interval**: `number`

Defined in: [index.ts:104](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L104)

Recommended poll interval in seconds.

---

### public_key

> **public_key**: `string`

Defined in: [index.ts:96](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L96)

Base64-encoded Ed25519 public key for webhook signature verification.

---

### public_key_format

> **public_key_format**: `string`

Defined in: [index.ts:98](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L98)

Key encoding format (e.g. `"raw"`).

---

### server_id

> **server_id**: `string`

Defined in: [index.ts:102](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L102)

Unique identifier for this server instance.

---

### version

> **version**: `string`

Defined in: [index.ts:94](https://github.com/zooid-ai/zooid/blob/5bc27c64e33aef25cac6da352b58be878127fea2/packages/types/src/index.ts#L94)

Zooid protocol version (semver).
