---
editUrl: false
next: false
prev: false
title: "ServerIdentity"
---

Defined in: [Code/zooid/packages/types/src/index.ts:117](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L117)

Editable server identity from `GET /api/v1/server` and `PUT /api/v1/server`.

Human-readable metadata about who operates this Zooid instance.
Editable by admins.

## Properties

### company

> **company**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:127](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L127)

Company or organization name.

***

### description

> **description**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:121](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L121)

Optional description of this server's purpose.

***

### email

> **email**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:129](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L129)

Contact email address.

***

### name

> **name**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:119](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L119)

Display name for this server.

***

### owner

> **owner**: `string` \| `null`

Defined in: [Code/zooid/packages/types/src/index.ts:125](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L125)

Name of the server operator.

***

### tags

> **tags**: `string`[]

Defined in: [Code/zooid/packages/types/src/index.ts:123](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L123)

Arbitrary tags for categorization.

***

### updated\_at

> **updated\_at**: `string`

Defined in: [Code/zooid/packages/types/src/index.ts:131](https://github.com/zooid-ai/zooid/blob/72dceaf8cbf9301a54bcc99d10c16e83bf471a88/packages/types/src/index.ts#L131)

ISO 8601 timestamp of the last update.
