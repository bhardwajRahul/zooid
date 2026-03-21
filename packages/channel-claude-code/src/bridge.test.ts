import { describe, it, expect, vi, beforeEach } from 'vitest';
import { zooidEventToNotification, createBridge } from './bridge.js';
import type { ZooidEvent } from '@zooid/sdk';

function makeEvent(overrides: Partial<ZooidEvent> = {}): ZooidEvent {
  return {
    id: '01JQ000000000000000000',
    channel_id: 'tasks',
    publisher_id: 'alice-123',
    publisher_name: 'alice',
    type: 'message',
    reply_to: null,
    data: '{"body":"hello world"}',
    meta: null,
    created_at: '2026-03-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('zooidEventToNotification', () => {
  it('extracts body field from JSON data', () => {
    const event = makeEvent({ data: '{"body":"deploy to staging"}' });
    const result = zooidEventToNotification(event);
    expect(result.content).toBe('deploy to staging');
  });

  it('uses plain string data as content', () => {
    const event = makeEvent({ data: '"just a string"' });
    const result = zooidEventToNotification(event);
    expect(result.content).toBe('just a string');
  });

  it('stringifies non-body JSON data', () => {
    const event = makeEvent({
      data: '{"action":"restart","target":"worker-3"}',
    });
    const result = zooidEventToNotification(event);
    expect(result.content).toBe('{"action":"restart","target":"worker-3"}');
  });

  it('maps all meta fields correctly', () => {
    const event = makeEvent({
      channel_id: 'tasks',
      id: '01JQ000000000000000001',
      publisher_name: 'alice',
      publisher_id: 'alice-123',
      type: 'message',
      reply_to: '01JQ000000000000000000',
      created_at: '2026-03-21T12:00:00.000Z',
    });
    const result = zooidEventToNotification(event);
    expect(result.meta).toEqual({
      channel: 'tasks',
      event_id: '01JQ000000000000000001',
      sender: 'alice',
      sender_id: 'alice-123',
      event_type: 'message',
      reply_to: '01JQ000000000000000000',
      created_at: '2026-03-21T12:00:00.000Z',
    });
  });

  it('omits sender when publisher_name is null', () => {
    const event = makeEvent({ publisher_name: null });
    const result = zooidEventToNotification(event);
    expect(result.meta).not.toHaveProperty('sender');
  });

  it('omits sender_id when publisher_id is null', () => {
    const event = makeEvent({ publisher_id: null });
    const result = zooidEventToNotification(event);
    expect(result.meta).not.toHaveProperty('sender_id');
  });

  it('omits event_type when type is null', () => {
    const event = makeEvent({ type: null });
    const result = zooidEventToNotification(event);
    expect(result.meta).not.toHaveProperty('event_type');
  });

  it('omits reply_to when null', () => {
    const event = makeEvent({ reply_to: null });
    const result = zooidEventToNotification(event);
    expect(result.meta).not.toHaveProperty('reply_to');
  });

  it('handles malformed JSON data gracefully', () => {
    const event = makeEvent({ data: 'not valid json{' });
    const result = zooidEventToNotification(event);
    expect(result.content).toBe('not valid json{');
  });
});

describe('createBridge', () => {
  const mockSubscribe = vi.fn();
  const mockPublish = vi.fn();
  const mockPoll = vi.fn();
  const mockNotification = vi.fn();

  const mockClient = {
    subscribe: mockSubscribe,
    publish: mockPublish,
    poll: mockPoll,
  };

  const mockMcpServer = {
    notification: mockNotification,
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockPoll.mockResolvedValue({ events: [], cursor: null });
    mockSubscribe.mockResolvedValue(() => {});
  });

  it('subscribes to the configured channel', async () => {
    const bridge = createBridge(
      { channel: 'tasks', transport: 'ws', pollInterval: 3000 },
      mockClient as any,
      mockMcpServer as any,
    );
    await bridge.start();

    expect(mockSubscribe).toHaveBeenCalledWith('tasks', expect.any(Function), {
      mode: 'ws',
      interval: 3000,
    });
  });

  it('filters echo events (own published event IDs)', async () => {
    const publishedEvent = makeEvent({ id: 'published-event-1' });
    mockPublish.mockResolvedValue(publishedEvent);

    const bridge = createBridge(
      { channel: 'tasks', transport: 'auto', pollInterval: 5000 },
      mockClient as any,
      mockMcpServer as any,
    );
    await bridge.start();

    // Publish a message — its event ID gets tracked
    await bridge.publish('hello');

    // Simulate receiving the same event back
    const callback = mockSubscribe.mock.calls[0][1];
    await callback(makeEvent({ id: 'published-event-1' }));

    expect(mockNotification).not.toHaveBeenCalled();
  });

  it('pushes notifications for events from other publishers', async () => {
    const bridge = createBridge(
      { channel: 'tasks', transport: 'auto', pollInterval: 5000 },
      mockClient as any,
      mockMcpServer as any,
    );
    await bridge.start();

    const callback = mockSubscribe.mock.calls[0][1];

    await callback(
      makeEvent({
        publisher_id: 'alice-123',
        publisher_name: 'alice',
        data: '{"body":"deploy please"}',
      }),
    );

    expect(mockNotification).toHaveBeenCalledWith({
      method: 'notifications/claude/channel',
      params: {
        content: 'deploy please',
        meta: expect.objectContaining({
          sender: 'alice',
          sender_id: 'alice-123',
        }),
      },
    });
  });

  it('publishes replies with correct envelope', async () => {
    mockPublish.mockResolvedValue(makeEvent());

    const bridge = createBridge(
      { channel: 'tasks', transport: 'auto', pollInterval: 5000 },
      mockClient as any,
      mockMcpServer as any,
    );
    await bridge.start();

    await bridge.publish('done deploying', '01JQ000000000000000000', 'message');

    expect(mockPublish).toHaveBeenCalledWith('tasks', {
      data: { body: 'done deploying' },
      reply_to: '01JQ000000000000000000',
      type: 'message',
    });
  });

  it('publishes with default type when not specified', async () => {
    mockPublish.mockResolvedValue(makeEvent());

    const bridge = createBridge(
      { channel: 'tasks', transport: 'auto', pollInterval: 5000 },
      mockClient as any,
      mockMcpServer as any,
    );
    await bridge.start();

    await bridge.publish('hello');

    expect(mockPublish).toHaveBeenCalledWith('tasks', {
      data: { body: 'hello' },
      reply_to: undefined,
      type: 'message',
    });
  });

  it('calls unsubscribe on stop', async () => {
    const mockUnsub = vi.fn();
    mockSubscribe.mockResolvedValue(mockUnsub);

    const bridge = createBridge(
      { channel: 'tasks', transport: 'auto', pollInterval: 5000 },
      mockClient as any,
      mockMcpServer as any,
    );
    await bridge.start();
    bridge.stop();

    expect(mockUnsub).toHaveBeenCalled();
  });

  it('skips events at or before the high-water mark', async () => {
    // Simulate initial poll returning events up to 'HWM-ID'
    mockPoll.mockResolvedValue({
      events: [makeEvent({ id: 'HWM-ID' })],
      cursor: 'c1',
    });

    const bridge = createBridge(
      { channel: 'tasks', transport: 'auto', pollInterval: 5000 },
      mockClient as any,
      mockMcpServer as any,
    );
    await bridge.start();

    const callback = mockSubscribe.mock.calls[0][1];

    // Event at the high-water mark: skipped
    await callback(makeEvent({ id: 'HWM-ID' }));
    expect(mockNotification).not.toHaveBeenCalled();

    // Event after the high-water mark: delivered
    await callback(makeEvent({ id: 'NEWER-EVENT' }));
    expect(mockNotification).toHaveBeenCalledTimes(1);
  });
});
