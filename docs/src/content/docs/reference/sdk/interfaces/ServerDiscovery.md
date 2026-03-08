---
editUrl: false
next: false
prev: false
title: "ServerDiscovery"
---

Defined in: [Code/zooid/packages/types/src/index.ts:92](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L92)

Server discovery metadata from `GET /.well-known/zooid.json`.

Contains the information needed by agents to discover and verify
a Zooid server: its public signing key, supported delivery mechanisms,
and recommended poll interval.

## Properties

### algorithm

> **algorithm**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:100](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L100)

Signing algorithm (e.g. `"Ed25519"`).

***

### delivery

> **delivery**: `string`[]

Defined in: [Code/zooid/packages/types/src/index.ts:106](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L106)

Supported delivery mechanisms (e.g. `["polling", "webhooks", "rss"]`).

***

### poll\_interval

> **poll\_interval**: `number`

Defined in: [Code/zooid/packages/types/src/index.ts:104](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L104)

Recommended poll interval in seconds.

***

### public\_key

> **public\_key**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:96](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L96)

Base64-encoded Ed25519 public key for webhook signature verification.

***

### public\_key\_format

> **public\_key\_format**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:98](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L98)

Key encoding format (e.g. `"raw"`).

***

### server\_id

> **server\_id**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:102](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L102)

Unique identifier for this server instance.

***

### version

> **version**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:94](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/types/src/index.ts#L94)

Zooid protocol version (semver).
