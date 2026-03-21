import type { ZooidClient, ZooidEvent } from '@zooid/sdk';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ChannelNotification } from './types.js';

export function zooidEventToNotification(
  event: ZooidEvent,
): ChannelNotification {
  let content: string;

  try {
    const parsed = JSON.parse(event.data);
    if (typeof parsed === 'string') {
      content = parsed;
    } else if (typeof parsed.body === 'string') {
      content = parsed.body;
    } else {
      content = JSON.stringify(parsed);
    }
  } catch {
    // Malformed JSON — use raw data string
    content = event.data;
  }

  const meta: Record<string, string> = {
    channel: event.channel_id,
    event_id: event.id,
    created_at: event.created_at,
  };

  if (event.publisher_name) meta.sender = event.publisher_name;
  if (event.publisher_id) meta.sender_id = event.publisher_id;
  if (event.type) meta.event_type = event.type;
  if (event.reply_to) meta.reply_to = event.reply_to;

  return { content, meta };
}

interface BridgeOptions {
  channel: string;
  transport: 'auto' | 'ws' | 'poll';
  pollInterval: number;
}

export function createBridge(
  options: BridgeOptions,
  client: ZooidClient,
  mcpServer: Server,
) {
  const ownEventIds = new Set<string>();
  let unsubscribe: (() => void) | null = null;
  // Track last delivered event ID — events at or before this are skipped.
  // ULIDs are lexicographically ordered, so string comparison works.
  let lastDeliveredId: string | null = null;

  async function start() {
    // Poll once to get the high-water mark — skip all existing events
    const initial = await client.poll(options.channel);
    if (initial.events.length > 0) {
      lastDeliveredId = initial.events[initial.events.length - 1].id;
    }

    unsubscribe = await client.subscribe(
      options.channel,
      async (event: ZooidEvent) => {
        // Skip events at or before our high-water mark (handles poll replays)
        if (lastDeliveredId && event.id <= lastDeliveredId) {
          return;
        }

        // Echo filter — skip events we published ourselves
        if (ownEventIds.has(event.id)) {
          ownEventIds.delete(event.id);
          lastDeliveredId = event.id;
          return;
        }

        lastDeliveredId = event.id;

        const notification = zooidEventToNotification(event);
        await mcpServer.notification({
          method: 'notifications/claude/channel',
          params: notification as unknown as Record<string, unknown>,
        });
      },
      {
        mode: options.transport,
        interval: options.pollInterval,
      },
    );
  }

  async function publish(message: string, inReplyTo?: string, type?: string) {
    const event = await client.publish(options.channel, {
      data: { body: message },
      reply_to: inReplyTo,
      type: type ?? 'message',
    });
    ownEventIds.add(event.id);
  }

  function stop() {
    unsubscribe?.();
    unsubscribe = null;
  }

  return { start, publish, stop };
}
