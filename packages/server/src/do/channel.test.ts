import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import type { ChannelContext, DOEvent } from './channel';

// Helper: get a DO stub by channel name
function getChannelStub(channelId: string) {
  const id = env.CHANNEL_DO.idFromName(channelId);
  return env.CHANNEL_DO.get(id);
}

// Helper: build a ChannelContext
function makeCtx(overrides: Partial<ChannelContext> = {}): ChannelContext {
  return {
    channel_id: 'test-channel',
    is_public: true,
    retention_days: 7,
    signing_key: undefined,
    server_url: 'https://test.zooid.dev',
    server_id: 'test-server',
    ...overrides,
  };
}

// ─── Schema & Migrations ───────────────────────────────────────

describe('ChannelDO: Schema & Migrations', () => {
  it('initializes SQLite schema on first access', async () => {
    const stub = getChannelStub('schema-test');
    const ctx = makeCtx({ channel_id: 'schema-test' });

    const stats = await stub.getStats(ctx);
    expect(stats).toEqual({ event_count: 0, last_event_at: null });
  });

  it('is idempotent — repeated access does not fail', async () => {
    const stub = getChannelStub('idempotent-test');
    const ctx = makeCtx({ channel_id: 'idempotent-test' });

    await stub.getStats(ctx);
    await stub.getStats(ctx);
    const stats = await stub.getStats(ctx);
    expect(stats.event_count).toBe(0);
  });
});

// ─── Publish Events ─────────────────────────────────────────────

describe('ChannelDO: Publish Events', () => {
  it('publishes a single event and returns it with a ULID', async () => {
    const stub = getChannelStub('publish-single');
    const ctx = makeCtx({ channel_id: 'publish-single' });

    const event = await stub.publishEvent(ctx, {
      publisher_id: 'user:alice',
      publisher_name: 'Alice',
      type: 'message',
      data: JSON.stringify({ text: 'hello' }),
    });

    expect(event).toBeDefined();
    expect(event.id).toMatch(/^[0-9A-Z]{26}$/);
    expect(event.publisher_id).toBe('user:alice');
    expect(event.publisher_name).toBe('Alice');
    expect(event.type).toBe('message');
    expect(event.data).toBe(JSON.stringify({ text: 'hello' }));
    expect(event.reply_to).toBeNull();
    expect(event.created_at).toBeDefined();
  });

  it('publishes a batch of events', async () => {
    const stub = getChannelStub('publish-batch');
    const ctx = makeCtx({ channel_id: 'publish-batch' });

    const events = await stub.publishEvents(ctx, [
      { type: 'a', data: '{"n":1}' },
      { type: 'b', data: '{"n":2}' },
      { type: 'c', data: '{"n":3}' },
    ]);

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('a');
    expect(events[1].type).toBe('b');
    expect(events[2].type).toBe('c');
    expect(events[0].id < events[1].id).toBe(true);
    expect(events[1].id < events[2].id).toBe(true);
  });

  // DO RPC throws break miniflare's isolated storage in vitest-pool-workers.
  // These validations work at runtime but can't be tested at the DO unit level.
  // See: https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/#isolated-storage
  it.skip('rejects batch larger than 100', async () => {
    const stub = getChannelStub('publish-batch-limit');
    const ctx = makeCtx({ channel_id: 'publish-batch-limit' });

    const inputs = Array.from({ length: 101 }, (_, i) => ({
      data: `{"n":${i}}`,
    }));

    await expect(stub.publishEvents(ctx, inputs)).rejects.toThrow();
  });

  it.skip('rejects events with data exceeding 64KB', async () => {
    const stub = getChannelStub('publish-size-limit');
    const ctx = makeCtx({ channel_id: 'publish-size-limit' });

    const bigData = JSON.stringify({ text: 'x'.repeat(65536) });

    await expect(stub.publishEvent(ctx, { data: bigData })).rejects.toThrow();
  });

  it('publishes event with null optional fields', async () => {
    const stub = getChannelStub('publish-minimal');
    const ctx = makeCtx({ channel_id: 'publish-minimal' });

    const event = await stub.publishEvent(ctx, {
      data: '{"minimal":true}',
    });

    expect(event.publisher_id).toBeNull();
    expect(event.publisher_name).toBeNull();
    expect(event.type).toBeNull();
    expect(event.reply_to).toBeNull();
  });
});

// ─── Poll Events ────────────────────────────────────────────────

describe('ChannelDO: Poll Events', () => {
  it('returns empty array when no events exist', async () => {
    const stub = getChannelStub('poll-empty');
    const ctx = makeCtx({ channel_id: 'poll-empty' });

    const result = await stub.pollEvents(ctx, {});
    expect(result.events).toEqual([]);
  });

  it('returns events in chronological order', async () => {
    const stub = getChannelStub('poll-order');
    const ctx = makeCtx({ channel_id: 'poll-order' });

    await stub.publishEvent(ctx, { type: 'first', data: '{}' });
    await stub.publishEvent(ctx, { type: 'second', data: '{}' });
    await stub.publishEvent(ctx, { type: 'third', data: '{}' });

    const result = await stub.pollEvents(ctx, {});
    expect(result.events).toHaveLength(3);
    expect(result.events[0].type).toBe('first');
    expect(result.events[2].type).toBe('third');
  });

  it('supports cursor-based pagination', async () => {
    const stub = getChannelStub('poll-cursor');
    const ctx = makeCtx({ channel_id: 'poll-cursor' });

    for (let i = 0; i < 5; i++) {
      await stub.publishEvent(ctx, { type: `e${i}`, data: '{}' });
    }

    // First poll with since anchor to enable forward pagination
    const page1 = await stub.pollEvents(ctx, {
      limit: 2,
      since: '2000-01-01T00:00:00Z',
    });
    expect(page1.events).toHaveLength(2);
    expect(page1.has_more).toBe(true);
    expect(page1.cursor).toBeDefined();

    const page2 = await stub.pollEvents(ctx, {
      limit: 2,
      cursor: page1.cursor!,
    });
    expect(page2.events).toHaveLength(2);
    expect(page2.has_more).toBe(true);

    const page3 = await stub.pollEvents(ctx, {
      limit: 2,
      cursor: page2.cursor!,
    });
    expect(page3.events).toHaveLength(1);
    expect(page3.has_more).toBe(false);
  });

  it('filters by event type', async () => {
    const stub = getChannelStub('poll-type-filter');
    const ctx = makeCtx({ channel_id: 'poll-type-filter' });

    await stub.publishEvent(ctx, { type: 'message', data: '{}' });
    await stub.publishEvent(ctx, { type: 'reaction', data: '{}' });
    await stub.publishEvent(ctx, { type: 'message', data: '{}' });

    const result = await stub.pollEvents(ctx, { type: 'message' });
    expect(result.events).toHaveLength(2);
    expect(result.events.every((e: DOEvent) => e.type === 'message')).toBe(
      true,
    );
  });

  it('filters by publisher_id', async () => {
    const stub = getChannelStub('poll-publisher');
    const ctx = makeCtx({ channel_id: 'poll-publisher' });

    await stub.publishEvent(ctx, { publisher_id: 'alice', data: '{}' });
    await stub.publishEvent(ctx, { publisher_id: 'bob', data: '{}' });
    await stub.publishEvent(ctx, { publisher_id: 'alice', data: '{}' });

    const result = await stub.pollEvents(ctx, { publisher_id: 'alice' });
    expect(result.events).toHaveLength(2);
  });

  it('respects limit (max 100)', async () => {
    const stub = getChannelStub('poll-limit');
    const ctx = makeCtx({ channel_id: 'poll-limit' });

    for (let i = 0; i < 5; i++) {
      await stub.publishEvent(ctx, { data: `{"n":${i}}` });
    }

    const result = await stub.pollEvents(ctx, { limit: 3 });
    expect(result.events).toHaveLength(3);
  });
});

// ─── Get & Delete Events ────────────────────────────────────────

describe('ChannelDO: Get & Delete Events', () => {
  it('gets a single event by ID', async () => {
    const stub = getChannelStub('get-event');
    const ctx = makeCtx({ channel_id: 'get-event' });

    const created = await stub.publishEvent(ctx, {
      type: 'test',
      data: '{"hello":"world"}',
    });

    const fetched = await stub.getEvent(ctx, created.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.data).toBe('{"hello":"world"}');
  });

  it('returns null for non-existent event', async () => {
    const stub = getChannelStub('get-missing');
    const ctx = makeCtx({ channel_id: 'get-missing' });

    await stub.getStats(ctx); // init

    const fetched = await stub.getEvent(ctx, '01NONEXISTENT00000000000000');
    expect(fetched).toBeNull();
  });

  it('deletes an event by ID', async () => {
    const stub = getChannelStub('delete-event');
    const ctx = makeCtx({ channel_id: 'delete-event' });

    const created = await stub.publishEvent(ctx, { data: '{}' });
    const deleted = await stub.deleteEvent(ctx, created.id);
    expect(deleted).toBe(true);

    const fetched = await stub.getEvent(ctx, created.id);
    expect(fetched).toBeNull();
  });

  it('returns false when deleting non-existent event', async () => {
    const stub = getChannelStub('delete-missing');
    const ctx = makeCtx({ channel_id: 'delete-missing' });

    await stub.getStats(ctx); // init
    const deleted = await stub.deleteEvent(ctx, '01NONEXISTENT00000000000000');
    expect(deleted).toBe(false);
  });
});

// ─── Retention Cleanup ──────────────────────────────────────────

describe('ChannelDO: Retention Cleanup', () => {
  it('lazy-deletes expired events on poll', async () => {
    const stub = getChannelStub('retention');
    const ctx = makeCtx({ channel_id: 'retention', retention_days: 0 });

    await stub.publishEvent(ctx, { data: '{"old":true}' });

    // Poll triggers lazy cleanup — with 0-day retention, event should be pruned
    const result = await stub.pollEvents(ctx, {});
    expect(result.events).toHaveLength(0);
  });
});

// ─── Threading ──────────────────────────────────────────────────

describe('ChannelDO: Threading', () => {
  it('publishes a reply with reply_to', async () => {
    const stub = getChannelStub('thread-reply');
    const ctx = makeCtx({ channel_id: 'thread-reply' });

    const parent = await stub.publishEvent(ctx, {
      type: 'question',
      data: '{"text":"What is 2+2?"}',
    });

    const reply = await stub.publishEvent(ctx, {
      type: 'answer',
      reply_to: parent.id,
      data: '{"text":"4"}',
    });

    expect(reply.reply_to).toBe(parent.id);
  });

  // DO RPC throws break miniflare's isolated storage (see skip comment above)
  it.skip('rejects reply_to referencing non-existent event', async () => {
    const stub = getChannelStub('thread-bad-ref');
    const ctx = makeCtx({ channel_id: 'thread-bad-ref' });

    await stub.getStats(ctx); // init

    await expect(
      stub.publishEvent(ctx, {
        reply_to: '01NONEXISTENT00000000000000',
        data: '{}',
      }),
    ).rejects.toThrow();
  });

  it('getThread returns all descendants of root event', async () => {
    const stub = getChannelStub('thread-tree');
    const ctx = makeCtx({ channel_id: 'thread-tree' });

    const root = await stub.publishEvent(ctx, {
      type: 'question',
      data: '{"text":"root"}',
    });

    const reply1 = await stub.publishEvent(ctx, {
      reply_to: root.id,
      data: '{"text":"reply1"}',
    });

    await stub.publishEvent(ctx, {
      reply_to: reply1.id,
      data: '{"text":"reply2 (nested)"}',
    });

    await stub.publishEvent(ctx, {
      reply_to: root.id,
      data: '{"text":"reply3 (sibling)"}',
    });

    const thread = await stub.getThread(ctx, root.id);
    expect(thread).toHaveLength(3);

    const texts = thread.map((e: DOEvent) => e.data);
    expect(texts).toContain('{"text":"reply1"}');
    expect(texts).toContain('{"text":"reply2 (nested)"}');
    expect(texts).toContain('{"text":"reply3 (sibling)"}');
  });

  it('getReplies returns only direct replies (depth=1)', async () => {
    const stub = getChannelStub('thread-direct');
    const ctx = makeCtx({ channel_id: 'thread-direct' });

    const root = await stub.publishEvent(ctx, { data: '{"text":"root"}' });

    const reply1 = await stub.publishEvent(ctx, {
      reply_to: root.id,
      data: '{"text":"direct reply"}',
    });

    // Nested reply (reply to reply1, not root)
    await stub.publishEvent(ctx, {
      reply_to: reply1.id,
      data: '{"text":"nested reply"}',
    });

    const replies = await stub.getReplies(ctx, root.id);
    expect(replies).toHaveLength(1);
    expect(replies[0].data).toBe('{"text":"direct reply"}');
  });

  it('getThread returns empty array for event with no replies', async () => {
    const stub = getChannelStub('thread-no-replies');
    const ctx = makeCtx({ channel_id: 'thread-no-replies' });

    const event = await stub.publishEvent(ctx, { data: '{}' });
    const thread = await stub.getThread(ctx, event.id);
    expect(thread).toEqual([]);
  });

  it('thread_ancestors cascade-deletes when event is deleted', async () => {
    const stub = getChannelStub('thread-cascade');
    const ctx = makeCtx({ channel_id: 'thread-cascade' });

    const root = await stub.publishEvent(ctx, {
      data: '{"root":true}',
    });
    await stub.publishEvent(ctx, {
      reply_to: root.id,
      data: '{"reply":true}',
    });

    await stub.deleteEvent(ctx, root.id);

    const thread = await stub.getThread(ctx, root.id);
    expect(thread).toEqual([]);
  });

  it('supports reactions as replies with type=reaction', async () => {
    const stub = getChannelStub('thread-reactions');
    const ctx = makeCtx({ channel_id: 'thread-reactions' });

    const message = await stub.publishEvent(ctx, {
      type: 'message',
      data: '{"text":"Great work!"}',
    });

    await stub.publishEvent(ctx, {
      type: 'reaction',
      reply_to: message.id,
      data: '"🔥"',
    });

    await stub.publishEvent(ctx, {
      type: 'reaction',
      reply_to: message.id,
      data: '"👍"',
    });

    await stub.publishEvent(ctx, {
      type: 'response',
      reply_to: message.id,
      data: '{"text":"Thanks!"}',
    });

    const allReplies = await stub.getReplies(ctx, message.id);
    expect(allReplies).toHaveLength(3);
  });

  it('handles deep reply chains (10+ levels)', async () => {
    const stub = getChannelStub('thread-deep');
    const ctx = makeCtx({ channel_id: 'thread-deep' });

    let parentId: string | undefined;
    const events: DOEvent[] = [];
    for (let i = 0; i < 12; i++) {
      const event = await stub.publishEvent(ctx, {
        reply_to: parentId,
        data: `{"depth":${i}}`,
      });
      events.push(event);
      parentId = event.id;
    }

    // Root event (depth 0) — getThread should return 11 descendants
    const thread = await stub.getThread(ctx, events[0].id);
    expect(thread).toHaveLength(11);

    // Middle event (depth 5) — getThread returns events 6-11
    const subThread = await stub.getThread(ctx, events[5].id);
    expect(subThread).toHaveLength(6);
  });
});

// ─── Meta Column ────────────────────────────────────────────────

describe('ChannelDO: Meta Column', () => {
  it('stores and returns meta when provided', async () => {
    const stub = getChannelStub('meta-store');
    const ctx = makeCtx({ channel_id: 'meta-store' });

    const meta = JSON.stringify({ component: 'trade-card@0.2' });
    const event = await stub.publishEvent(ctx, {
      publisher_id: 'user:alice',
      publisher_name: 'Alice',
      type: 'execution',
      data: JSON.stringify({ symbol: 'AAPL', side: 'buy' }),
      meta,
    });

    expect(event.meta).toBe(meta);

    const fetched = await stub.getEvent(ctx, event.id);
    expect(fetched?.meta).toBe(meta);
  });

  it('returns null meta when not provided', async () => {
    const stub = getChannelStub('meta-null');
    const ctx = makeCtx({ channel_id: 'meta-null' });

    const event = await stub.publishEvent(ctx, {
      data: JSON.stringify({ body: 'hello' }),
    });

    expect(event.meta).toBeNull();
  });

  it('includes meta in poll results', async () => {
    const stub = getChannelStub('meta-poll');
    const ctx = makeCtx({ channel_id: 'meta-poll' });

    const meta = JSON.stringify({ component: 'signal-card' });
    await stub.publishEvent(ctx, {
      type: 'signal',
      data: JSON.stringify({ body: 'buy AAPL' }),
      meta,
    });

    const result = await stub.pollEvents(ctx, {});
    expect(result.events[0].meta).toBe(meta);
  });

  it('includes meta in batch publish', async () => {
    const stub = getChannelStub('meta-batch');
    const ctx = makeCtx({ channel_id: 'meta-batch' });

    const events = await stub.publishEvents(ctx, [
      {
        type: 'signal',
        data: JSON.stringify({ body: 'one' }),
        meta: JSON.stringify({ component: 'card-a' }),
      },
      {
        type: 'signal',
        data: JSON.stringify({ body: 'two' }),
      },
    ]);

    expect(events[0].meta).toBe(JSON.stringify({ component: 'card-a' }));
    expect(events[1].meta).toBeNull();
  });

  it('includes meta in thread/replies results', async () => {
    const stub = getChannelStub('meta-thread');
    const ctx = makeCtx({ channel_id: 'meta-thread' });

    const parent = await stub.publishEvent(ctx, {
      data: '{"text":"root"}',
      meta: JSON.stringify({ component: 'parent-card' }),
    });

    await stub.publishEvent(ctx, {
      reply_to: parent.id,
      data: '{"text":"reply"}',
      meta: JSON.stringify({ component: 'reply-card' }),
    });

    const thread = await stub.getThread(ctx, parent.id);
    expect(thread[0].meta).toBe(JSON.stringify({ component: 'reply-card' }));

    const replies = await stub.getReplies(ctx, parent.id);
    expect(replies[0].meta).toBe(JSON.stringify({ component: 'reply-card' }));
  });
});

// ─── Webhooks ───────────────────────────────────────────────────

describe('ChannelDO: Webhooks', () => {
  it('registers a webhook', async () => {
    const stub = getChannelStub('webhook-register');
    const ctx = makeCtx({ channel_id: 'webhook-register' });

    const webhook = await stub.registerWebhook(ctx, {
      url: 'https://example.com/hook',
      ttl_seconds: 86400,
    });

    expect(webhook).toBeDefined();
    expect(webhook.id).toBeDefined();
    expect(webhook.url).toBe('https://example.com/hook');
    expect(webhook.expires_at).toBeDefined();
  });

  it('upserts webhook on duplicate URL', async () => {
    const stub = getChannelStub('webhook-upsert');
    const ctx = makeCtx({ channel_id: 'webhook-upsert' });

    const wh1 = await stub.registerWebhook(ctx, {
      url: 'https://example.com/hook',
      ttl_seconds: 86400,
    });

    const wh2 = await stub.registerWebhook(ctx, {
      url: 'https://example.com/hook',
      ttl_seconds: 172800,
    });

    expect(wh2.url).toBe(wh1.url);
  });

  it('registers webhook with event_types filter', async () => {
    const stub = getChannelStub('webhook-filter');
    const ctx = makeCtx({ channel_id: 'webhook-filter' });

    const webhook = await stub.registerWebhook(ctx, {
      url: 'https://example.com/hook',
      event_types: ['message', 'alert'],
      ttl_seconds: 86400,
    });

    expect(webhook.event_types).toBeDefined();
    const types = JSON.parse(webhook.event_types!);
    expect(types).toContain('message');
    expect(types).toContain('alert');
  });

  it('deletes a webhook', async () => {
    const stub = getChannelStub('webhook-delete');
    const ctx = makeCtx({ channel_id: 'webhook-delete' });

    const webhook = await stub.registerWebhook(ctx, {
      url: 'https://example.com/hook',
      ttl_seconds: 86400,
    });

    const deleted = await stub.deleteWebhook(ctx, webhook.id);
    expect(deleted).toBe(true);
  });

  it('returns false when deleting non-existent webhook', async () => {
    const stub = getChannelStub('webhook-delete-missing');
    const ctx = makeCtx({ channel_id: 'webhook-delete-missing' });

    await stub.getStats(ctx); // init
    const deleted = await stub.deleteWebhook(ctx, 'nonexistent');
    expect(deleted).toBe(false);
  });

  it('enforces TTL bounds (max 30 days)', async () => {
    const stub = getChannelStub('webhook-ttl-max');
    const ctx = makeCtx({ channel_id: 'webhook-ttl-max' });

    const webhook = await stub.registerWebhook(ctx, {
      url: 'https://example.com/hook',
      ttl_seconds: 90 * 86400,
    });

    const expiresAt = new Date(webhook.expires_at);
    const maxExpiry = new Date(Date.now() + 31 * 86400 * 1000);
    expect(expiresAt.getTime()).toBeLessThan(maxExpiry.getTime());
  });
});

// ─── Lifecycle ──────────────────────────────────────────────────

describe('ChannelDO: Lifecycle', () => {
  it('getStats returns event count and last event time', async () => {
    const stub = getChannelStub('stats');
    const ctx = makeCtx({ channel_id: 'stats' });

    await stub.publishEvent(ctx, { data: '{"a":1}' });
    await stub.publishEvent(ctx, { data: '{"b":2}' });

    const stats = await stub.getStats(ctx);
    expect(stats.event_count).toBe(2);
    expect(stats.last_event_at).toBeDefined();
  });

  it('destroy() deletes all storage', async () => {
    const stub = getChannelStub('destroy');
    const ctx = makeCtx({ channel_id: 'destroy' });

    await stub.publishEvent(ctx, { data: '{}' });
    await stub.registerWebhook(ctx, {
      url: 'https://example.com/hook',
      ttl_seconds: 86400,
    });

    await stub.destroy(ctx);

    const stats = await stub.getStats(ctx);
    expect(stats.event_count).toBe(0);
  });
});
