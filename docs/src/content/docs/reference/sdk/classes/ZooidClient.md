---
editUrl: false
next: false
prev: false
title: "ZooidClient"
---

Defined in: [Code/zooid/packages/sdk/src/client.ts:41](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L41)

Client for the Zooid pub/sub API.

Provides methods for channel management, event publishing/polling,
webhook registration, and server metadata access.

## Example

```ts
const client = new ZooidClient({
  server: 'https://zooid.example.workers.dev',
  token: 'eyJ...',
});

const channels = await client.listChannels();
```

## Constructors

### Constructor

> **new ZooidClient**(`options`): `ZooidClient`

Defined in: [Code/zooid/packages/sdk/src/client.ts:47](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L47)

#### Parameters

##### options

[`ZooidClientOptions`](/docs/reference/sdk/interfaces/zooidclientoptions/)

#### Returns

`ZooidClient`

## Properties

### server

> `readonly` **server**: `string`

Defined in: [Code/zooid/packages/sdk/src/client.ts:43](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L43)

Base URL of the Zooid server (trailing slashes stripped).

## Methods

### createChannel()

> **createChannel**(`options`): `Promise`\<[`CreateChannelResult`](/docs/reference/sdk/interfaces/createchannelresult/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:127](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L127)

Create a new channel via `POST /api/v1/channels`. Requires admin token.

#### Parameters

##### options

[`CreateChannelOptions`](/docs/reference/sdk/interfaces/createchanneloptions/)

#### Returns

`Promise`\<[`CreateChannelResult`](/docs/reference/sdk/interfaces/createchannelresult/)\>

***

### deleteChannel()

> **deleteChannel**(`channelId`): `Promise`\<`void`\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:162](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L162)

Delete a channel and all its data. Requires admin token.

#### Parameters

##### channelId

`string`

#### Returns

`Promise`\<`void`\>

***

### deleteEvent()

> **deleteEvent**(`channelId`, `eventId`): `Promise`\<`void`\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:167](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L167)

Delete a single event by ID. Requires admin or publish token.

#### Parameters

##### channelId

`string`

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

***

### getClaim()

> **getClaim**(`channels`, `action?`): `Promise`\<[`ClaimResult`](/docs/reference/sdk/interfaces/claimresult/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:150](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L150)

Generate a signed claim for the Zooid Directory. Requires admin token.

#### Parameters

##### channels

`string`[]

##### action?

`"delete"`

#### Returns

`Promise`\<[`ClaimResult`](/docs/reference/sdk/interfaces/claimresult/)\>

***

### getMetadata()

> **getMetadata**(): `Promise`\<[`ServerDiscovery`](/docs/reference/sdk/interfaces/serverdiscovery/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:101](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L101)

Fetch server discovery metadata from `GET /.well-known/zooid.json`.

#### Returns

`Promise`\<[`ServerDiscovery`](/docs/reference/sdk/interfaces/serverdiscovery/)\>

***

### getServerMeta()

> **getServerMeta**(): `Promise`\<[`ServerIdentity`](/docs/reference/sdk/interfaces/serveridentity/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:106](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L106)

Fetch editable server identity from `GET /api/v1/server`.

#### Returns

`Promise`\<[`ServerIdentity`](/docs/reference/sdk/interfaces/serveridentity/)\>

***

### listChannels()

> **listChannels**(): `Promise`\<`ChannelListItem`[]\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:118](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L118)

List all channels via `GET /api/v1/channels`.

#### Returns

`Promise`\<`ChannelListItem`[]\>

***

### mintToken()

> **mintToken**(`options`): `Promise`\<[`MintTokenResult`](/docs/reference/sdk/interfaces/minttokenresult/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:157](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L157)

Mint a new token. Requires admin token.

#### Parameters

##### options

[`MintTokenOptions`](/docs/reference/sdk/interfaces/minttokenoptions/)

#### Returns

`Promise`\<[`MintTokenResult`](/docs/reference/sdk/interfaces/minttokenresult/)\>

***

### poll()

> **poll**(`channelId`, `options?`): `Promise`\<[`PollResult`](/docs/reference/sdk/interfaces/pollresult/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:310](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L310)

Poll events from a channel with cursor-based pagination.

#### Parameters

##### channelId

`string`

##### options?

[`PollOptions`](/docs/reference/sdk/interfaces/polloptions/)

#### Returns

`Promise`\<[`PollResult`](/docs/reference/sdk/interfaces/pollresult/)\>

***

### publish()

> **publish**(`channelId`, `options`): `Promise`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:175](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L175)

Publish a single event to a channel. Requires a publish-scoped token.

#### Parameters

##### channelId

`string`

##### options

[`PublishOptions`](/docs/reference/sdk/interfaces/publishoptions/)

#### Returns

`Promise`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/)\>

***

### publishBatch()

> **publishBatch**(`channelId`, `events`): `Promise`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/)[]\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:191](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L191)

Publish multiple events in a single request. Requires a publish-scoped token.

#### Parameters

##### channelId

`string`

##### events

[`PublishOptions`](/docs/reference/sdk/interfaces/publishoptions/)[]

#### Returns

`Promise`\<[`ZooidEvent`](/docs/reference/sdk/interfaces/zooidevent/)[]\>

***

### registerWebhook()

> **registerWebhook**(`channelId`, `url`, `options?`): `Promise`\<`Webhook`\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:324](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L324)

Register a webhook to receive events via POST.

#### Parameters

##### channelId

`string`

##### url

`string`

##### options?

[`WebhookOptions`](/docs/reference/sdk/interfaces/webhookoptions/)

#### Returns

`Promise`\<`Webhook`\>

***

### removeWebhook()

> **removeWebhook**(`channelId`, `webhookId`): `Promise`\<`void`\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:340](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L340)

Remove a webhook registration. Requires admin token.

#### Parameters

##### channelId

`string`

##### webhookId

`string`

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`channelId`, `callback`, `options?`): `Promise`\<() => `void`\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:362](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L362)

Subscribe to a channel. Tries WebSocket first (mode `'auto'`), falls back to polling.

Returns a promise that resolves with an unsubscribe function.

#### Parameters

##### channelId

`string`

##### callback

(`event`) => `void`

##### options?

[`SubscribeOptions`](/docs/reference/sdk/interfaces/subscribeoptions/)

#### Returns

`Promise`\<() => `void`\>

#### Example

```ts
const unsub = await client.subscribe('my-channel', (event) => {
  console.log('New event:', event.id);
});

// Later: stop
unsub();
```

***

### tail()

#### Call Signature

> **tail**(`channelId`, `options`): [`TailStream`](/docs/reference/sdk/interfaces/tailstream/)

Defined in: [Code/zooid/packages/sdk/src/client.ts:228](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L228)

Fetch events from a channel.

Without `follow`, performs a one-shot poll (alias for [poll](/docs/reference/sdk/classes/zooidclient/#poll)).
With `follow: true`, returns an async iterable stream that wraps [subscribe](/docs/reference/sdk/classes/zooidclient/#subscribe).

##### Parameters

###### channelId

`string`

###### options

[`TailOptions`](/docs/reference/sdk/interfaces/tailoptions/) & `object`

##### Returns

[`TailStream`](/docs/reference/sdk/interfaces/tailstream/)

##### Example

```ts
// One-shot
const result = await client.tail('my-channel', { limit: 10 });

// Follow mode
const stream = client.tail('my-channel', { follow: true });
for await (const event of stream) {
  console.log(event);
}
```

#### Call Signature

> **tail**(`channelId`, `options?`): `Promise`\<[`PollResult`](/docs/reference/sdk/interfaces/pollresult/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:229](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L229)

Fetch events from a channel.

Without `follow`, performs a one-shot poll (alias for [poll](/docs/reference/sdk/classes/zooidclient/#poll)).
With `follow: true`, returns an async iterable stream that wraps [subscribe](/docs/reference/sdk/classes/zooidclient/#subscribe).

##### Parameters

###### channelId

`string`

###### options?

[`TailOptions`](/docs/reference/sdk/interfaces/tailoptions/)

##### Returns

`Promise`\<[`PollResult`](/docs/reference/sdk/interfaces/pollresult/)\>

##### Example

```ts
// One-shot
const result = await client.tail('my-channel', { limit: 10 });

// Follow mode
const stream = client.tail('my-channel', { follow: true });
for await (const event of stream) {
  console.log(event);
}
```

***

### updateChannel()

> **updateChannel**(`channelId`, `options`): `Promise`\<`ChannelListItem`\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:138](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L138)

Update an existing channel via `PATCH /api/v1/channels/:id`. Requires admin token.

#### Parameters

##### channelId

`string`

##### options

[`UpdateChannelOptions`](/docs/reference/sdk/interfaces/updatechanneloptions/)

#### Returns

`Promise`\<`ChannelListItem`\>

***

### updateServerMeta()

> **updateServerMeta**(`options`): `Promise`\<[`ServerIdentity`](/docs/reference/sdk/interfaces/serveridentity/)\>

Defined in: [Code/zooid/packages/sdk/src/client.ts:111](https://github.com/zooid-ai/zooid/blob/36c058ed097bff2acde6fe6189c261be7b5a43eb/packages/sdk/src/client.ts#L111)

Update server identity metadata via `PUT /api/v1/server`. Requires admin token.

#### Parameters

##### options

[`UpdateServerMetaOptions`](/docs/reference/sdk/interfaces/updateservermetaoptions/)

#### Returns

`Promise`\<[`ServerIdentity`](/docs/reference/sdk/interfaces/serveridentity/)\>
