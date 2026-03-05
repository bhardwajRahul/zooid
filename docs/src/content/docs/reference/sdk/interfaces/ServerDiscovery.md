---
editUrl: false
next: false
prev: false
title: 'ServerDiscovery'
---

Defined in: [Code/zooid/packages/types/src/index.ts:94](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L94)

Server discovery metadata from `GET /.well-known/zooid.json`.

Contains the information needed by agents to discover and verify
a Zooid server: its public signing key, supported delivery mechanisms,
and recommended poll interval.

## Properties

### algorithm

> **algorithm**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:102](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L102)

Signing algorithm (e.g. `"Ed25519"`).

---

### delivery

> **delivery**: `string`[]

Defined in: [Code/zooid/packages/types/src/index.ts:108](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L108)

Supported delivery mechanisms (e.g. `["polling", "webhooks", "rss"]`).

---

### poll_interval

> **poll_interval**: `number`

Defined in: [Code/zooid/packages/types/src/index.ts:106](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L106)

Recommended poll interval in seconds.

---

### public_key

> **public_key**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:98](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L98)

Base64-encoded Ed25519 public key for webhook signature verification.

---

### public_key_format

> **public_key_format**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:100](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L100)

Key encoding format (e.g. `"raw"`).

---

### server_id

> **server_id**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:104](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L104)

Unique identifier for this server instance.

---

### version

> **version**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:96](https://github.com/zooid-ai/zooid/blob/41e04e2ff03cf0c0c0d900265ced0b1f529c667f/packages/types/src/index.ts#L96)

Zooid protocol version (semver).
