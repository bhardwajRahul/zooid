import { Hono } from 'hono';
import { fromHono } from 'chanfana';
import type { Bindings, Variables } from './types';
import { wellKnown } from './routes/well-known';
import {
  requireAuth,
  requireScope,
  requireSubscribeIfPrivate,
  optionalAuth,
} from './middleware/auth';
import { resolveChannel } from './middleware/storage';
import { D1ChannelBackend } from './storage';
import {
  ListChannels,
  CreateChannel,
  UpdateChannel,
  DeleteChannel,
} from './routes/channels';
import {
  PublishEvents,
  PollEvents,
  GetEventById,
  DeleteEventById,
} from './routes/events';
import { RegisterWebhook, DeleteWebhook } from './routes/webhooks';
import { GetServerMeta, UpdateServerMeta } from './routes/server-meta';
import { GetTokenClaims, MintToken } from './routes/tokens';
import { DirectoryClaim } from './routes/directory';
import { ListKeys, AddKey, RevokeKey } from './routes/keys';
import { auth } from './routes/auth';
import { ws } from './routes/ws';
import { rss } from './routes/rss';
import { feed } from './routes/feed';
import { opml } from './routes/opml';

type Env = { Bindings: Bindings; Variables: Variables };

const app = new Hono<Env>();

// Well-known stays at root
app.route('', wellKnown);

// All API routes under /api
const api = new Hono<Env>();
const openapi = fromHono(api, {
  docs_url: '/docs',
  redoc_url: null,
  openapi_url: '/openapi.json',
  schema: {
    openapi: '3.1.0',
    info: {
      title: 'Zooid',
      version: '0.1.0',
      description: 'Pub/sub for AI agents',
    },
    security: [{ bearerAuth: [] }],
  },
});
openapi.registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// Wire up the channel storage backend
api.use('*', async (c, next) => {
  c.set('channelBackend', new D1ChannelBackend(c.env.DB, c.env.CHANNEL_DO));
  await next();
});

// Server meta routes
openapi.get('/server', GetServerMeta);
// @ts-expect-error chanfana types don't include middleware overloads
openapi.put('/server', requireAuth(), requireScope('admin'), UpdateServerMeta);

// Token routes
// @ts-expect-error chanfana types don't include middleware overloads
openapi.get('/tokens/claims', requireAuth(), GetTokenClaims);
// @ts-expect-error chanfana types don't include middleware overloads
openapi.post('/tokens', requireAuth(), requireScope('admin'), MintToken);

// Channel routes
// @ts-expect-error chanfana types don't include middleware overloads
openapi.get('/channels', optionalAuth(), ListChannels);
// @ts-expect-error chanfana types don't include middleware overloads
openapi.post('/channels', requireAuth(), requireScope('admin'), CreateChannel);
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.patch('/channels/:channelId', requireAuth(), requireScope('admin'), UpdateChannel);
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.delete('/channels/:channelId', requireAuth(), requireScope('admin'), resolveChannel('channelId'), DeleteChannel);

// Event routes
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.post('/channels/:channelId/events', requireAuth(), requireScope('publish', { channelParam: 'channelId' }), resolveChannel('channelId'), PublishEvents);
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.get('/channels/:channelId/events', requireSubscribeIfPrivate('channelId'), PollEvents);
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.get('/channels/:channelId/events/:eventId', requireSubscribeIfPrivate('channelId'), GetEventById);
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.delete('/channels/:channelId/events/:eventId', requireAuth(), requireScope('publish', { channelParam: 'channelId' }), resolveChannel('channelId'), DeleteEventById);

// Directory claim route
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.post('/directory/claim', requireAuth(), requireScope('admin'), DirectoryClaim);

// Webhook routes
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.post('/channels/:channelId/webhooks', requireSubscribeIfPrivate('channelId'), RegisterWebhook);
// prettier-ignore
// @ts-expect-error chanfana types don't include middleware overloads
openapi.delete('/channels/:channelId/webhooks/:webhookId', requireAuth(), requireScope('admin'), resolveChannel('channelId'), DeleteWebhook);

// Key management routes (admin-only)
// @ts-expect-error chanfana types don't include middleware overloads
openapi.get('/keys', requireAuth(), requireScope('admin'), ListKeys);
// @ts-expect-error chanfana types don't include middleware overloads
openapi.post('/keys', requireAuth(), requireScope('admin'), AddKey);
// @ts-expect-error chanfana types don't include middleware overloads
openapi.delete('/keys/:kid', requireAuth(), requireScope('admin'), RevokeKey);

// BFF auth routes (OIDC proxy — plain Hono, not OpenAPI)
api.route('', auth);

// Plain Hono routes (streaming/XML — not suited for OpenAPI)
api.route('', ws);
api.route('', rss);
api.route('', feed);
api.route('', opml);

api.get('/', (c) => c.json({ ok: true }));
app.route('/api/v1', api);

export { ChannelDO } from './do/channel';
export default app;
