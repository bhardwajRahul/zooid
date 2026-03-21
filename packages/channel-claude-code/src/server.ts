import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ZooidClient } from '@zooid/sdk';
import { createBridge } from './bridge.js';
import type { ChannelConfig } from './types.js';

const INSTRUCTIONS = `Messages from a Zooid pub/sub channel arrive as <channel source="zooid" sender="..." event_id="..." channel="...">.

To reply, call the zooid_reply tool with your message text. Pass the event_id attribute as in_reply_to to thread your reply.

Multiple people and agents may be posting to this channel. The sender attribute identifies who sent each message.`;

const ZOOID_REPLY_TOOL = {
  name: 'zooid_reply',
  description:
    'Reply to a message on the Zooid channel. Use this to respond to messages from the channel.',
  inputSchema: {
    type: 'object' as const,
    required: ['message'],
    properties: {
      message: {
        type: 'string',
        description: 'The reply text',
      },
      in_reply_to: {
        type: 'string',
        description:
          'Event ID to thread the reply to (from the event_id attribute)',
      },
      type: {
        type: 'string',
        description: 'Event type (default: message)',
      },
    },
  },
};

export async function createServer(config: ChannelConfig) {
  const mcpServer = new Server(
    { name: 'zooid', version: '0.0.1' },
    {
      capabilities: {
        experimental: { 'claude/channel': {} },
        tools: {},
      },
      instructions: INSTRUCTIONS,
    },
  );

  const client = new ZooidClient({
    server: config.server,
    ...(config.auth.mode === 'token'
      ? { token: config.auth.token }
      : {
          clientId: config.auth.clientId,
          clientSecret: config.auth.clientSecret,
          ...(config.auth.tokenEndpoint && {
            tokenEndpoint: config.auth.tokenEndpoint,
          }),
        }),
  });

  const bridge = createBridge(
    {
      channel: config.channel,
      transport: config.transport,
      pollInterval: config.pollInterval,
    },
    client,
    mcpServer,
  );

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [ZOOID_REPLY_TOOL],
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name !== 'zooid_reply') {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      };
    }

    try {
      await bridge.publish(
        args?.message as string,
        args?.in_reply_to as string | undefined,
        args?.type as string | undefined,
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Message published to Zooid channel.',
          },
        ],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Failed to publish: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  });

  await bridge.start();

  async function start() {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
  }

  return { mcpServer, bridge, start };
}
