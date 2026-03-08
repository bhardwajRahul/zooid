---
editUrl: false
next: false
prev: false
title: 'ServerIdentity'
---

Defined in: [index.ts:115](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L115)

Editable server identity from `GET /api/v1/server` and `PUT /api/v1/server`.

Human-readable metadata about who operates this Zooid instance.
Editable by admins.

## Properties

### company

> **company**: `string` \| `null`

Defined in: [index.ts:125](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L125)

Company or organization name.

---

### description

> **description**: `string` \| `null`

Defined in: [index.ts:119](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L119)

Optional description of this server's purpose.

---

### email

> **email**: `string` \| `null`

Defined in: [index.ts:127](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L127)

Contact email address.

---

### name

> **name**: `string`

Defined in: [index.ts:117](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L117)

Display name for this server.

---

### owner

> **owner**: `string` \| `null`

Defined in: [index.ts:123](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L123)

Name of the server operator.

---

### tags

> **tags**: `string`[]

Defined in: [index.ts:121](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L121)

Arbitrary tags for categorization.

---

### updated_at

> **updated_at**: `string`

Defined in: [index.ts:129](https://github.com/zooid-ai/zooid/blob/1eb33917f522d63b9b5629ec8298fdcb12ee1acf/packages/types/src/index.ts#L129)

ISO 8601 timestamp of the last update.
