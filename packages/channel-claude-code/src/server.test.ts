import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer } from './server.js';
import type { ChannelConfig } from './types.js';

interface MockServer {
  _info: unknown;
  _opts: { capabilities: Record<string, unknown>; instructions: string };
  _handlers: Map<string, Function>;
  setRequestHandler: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  notification: ReturnType<typeof vi.fn>;
}

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  const handlers = new Map<string, Function>();
  return {
    Server: vi.fn().mockImplementation((info, opts) => ({
      _info: info,
      _opts: opts,
      setRequestHandler: vi.fn((schema, handler) => {
        handlers.set(schema.method ?? schema, handler);
      }),
      _handlers: handlers,
      connect: vi.fn(),
      notification: vi.fn(),
    })),
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  ListToolsRequestSchema: { method: 'tools/list' },
  CallToolRequestSchema: { method: 'tools/call' },
}));

// Mock the bridge module
const mockBridgeStart = vi.fn();
const mockBridgeStop = vi.fn();
const mockBridgePublish = vi.fn();
vi.mock('./bridge.js', () => ({
  createBridge: vi.fn(() => ({
    start: mockBridgeStart,
    stop: mockBridgeStop,
    publish: mockBridgePublish,
  })),
}));

vi.mock('@zooid/sdk', () => ({
  ZooidClient: vi.fn().mockImplementation(() => ({})),
}));

const testConfig: ChannelConfig = {
  server: 'https://test.workers.dev',
  auth: { mode: 'token', token: 'test-token' },
  channel: 'tasks',
  transport: 'auto',
  pollInterval: 5000,
};

async function setup() {
  const result = await createServer(testConfig);
  return { ...result, mock: result.mcpServer as unknown as MockServer };
}

describe('createServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBridgeStart.mockResolvedValue(undefined);
    mockBridgePublish.mockResolvedValue(undefined);
  });

  it('declares claude/channel capability', async () => {
    const { mock } = await setup();
    expect(mock._opts.capabilities).toHaveProperty('experimental');
    expect(mock._opts.capabilities.experimental).toHaveProperty(
      'claude/channel',
    );
  });

  it('sets instructions string', async () => {
    const { mock } = await setup();
    expect(mock._opts.instructions).toContain('Zooid');
    expect(mock._opts.instructions).toContain('zooid_reply');
  });

  it('declares tools capability', async () => {
    const { mock } = await setup();
    expect(mock._opts.capabilities).toHaveProperty('tools');
  });

  it('lists zooid_reply tool with correct schema', async () => {
    const { mock } = await setup();
    const listHandler = mock._handlers.get('tools/list');
    expect(listHandler).toBeDefined();

    const result = await listHandler!();
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('zooid_reply');
    expect(result.tools[0].inputSchema.required).toContain('message');
    expect(result.tools[0].inputSchema.properties).toHaveProperty('message');
    expect(result.tools[0].inputSchema.properties).toHaveProperty(
      'in_reply_to',
    );
    expect(result.tools[0].inputSchema.properties).toHaveProperty('type');
  });

  it('routes zooid_reply tool call to bridge.publish()', async () => {
    const { mock } = await setup();
    const callHandler = mock._handlers.get('tools/call');

    await callHandler!({
      params: {
        name: 'zooid_reply',
        arguments: {
          message: 'done',
          in_reply_to: '01JQ000000000000000000',
          type: 'message',
        },
      },
    });

    expect(mockBridgePublish).toHaveBeenCalledWith(
      'done',
      '01JQ000000000000000000',
      'message',
    );
  });

  it('returns success content from zooid_reply', async () => {
    const { mock } = await setup();
    const callHandler = mock._handlers.get('tools/call');

    const result = await callHandler!({
      params: {
        name: 'zooid_reply',
        arguments: { message: 'done' },
      },
    });

    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('published') },
    ]);
  });

  it('returns error content for unknown tools', async () => {
    const { mock } = await setup();
    const callHandler = mock._handlers.get('tools/call');

    const result = await callHandler!({
      params: {
        name: 'unknown_tool',
        arguments: {},
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('unknown_tool');
  });

  it('returns error content when bridge.publish() fails', async () => {
    mockBridgePublish.mockRejectedValue(new Error('network error'));

    const { mock } = await setup();
    const callHandler = mock._handlers.get('tools/call');

    const result = await callHandler!({
      params: {
        name: 'zooid_reply',
        arguments: { message: 'hello' },
      },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('network error');
  });
});
