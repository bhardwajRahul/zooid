import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { runPublish, runPublishStream } from './publish';

let tmpDir: string;
const mockClient = {
  publish: vi.fn(),
};

vi.mock('@zooid/sdk', () => ({
  ZooidClient: vi.fn(() => mockClient),
}));

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zooid-test-'));
  vi.stubEnv('ZOOID_CONFIG_DIR', tmpDir);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(channelTokens: Record<string, string> = {}) {
  const channels: Record<string, unknown> = {};
  for (const [ch, tok] of Object.entries(channelTokens)) {
    channels[ch] = { publish_token: tok };
  }
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'state.json'),
    JSON.stringify({
      server: 'https://test.workers.dev',
      admin_token: 'admin-jwt',
      channels,
    }),
  );
}

describe('publish command', () => {
  it('publishes an event with type and data', async () => {
    writeConfig({ signals: 'pub-tok' });
    mockClient.publish.mockResolvedValueOnce({
      id: 'evt-1',
      channel_id: 'signals',
      type: 'alert',
      data: '{"v":1}',
    });

    const result = await runPublish('signals', {
      type: 'alert',
      data: '{"v":1}',
    });

    expect(mockClient.publish).toHaveBeenCalledWith('signals', {
      type: 'alert',
      data: { v: 1 },
    });
    expect(result.id).toBe('evt-1');
  });

  it('publishes from a JSON file', async () => {
    writeConfig({ signals: 'pub-tok' });
    const filePath = path.join(tmpDir, 'event.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ type: 'test', data: { a: 1 } }),
    );

    mockClient.publish.mockResolvedValueOnce({
      id: 'evt-2',
      channel_id: 'signals',
      type: 'test',
      data: '{"a":1}',
    });

    const result = await runPublish('signals', { file: filePath });
    expect(result.id).toBe('evt-2');
  });

  it('publishes data-only event without type', async () => {
    writeConfig({ signals: 'pub-tok' });
    mockClient.publish.mockResolvedValueOnce({
      id: 'evt-3',
      channel_id: 'signals',
      type: null,
      data: '{"hello":"world"}',
    });

    await runPublish('signals', { data: '{"hello":"world"}' });

    expect(mockClient.publish).toHaveBeenCalledWith('signals', {
      data: { hello: 'world' },
    });
  });

  it('publishes from positional data argument', async () => {
    writeConfig({ signals: 'pub-tok' });
    mockClient.publish.mockResolvedValueOnce({
      id: 'evt-5',
      channel_id: 'signals',
      type: 'alert',
      data: '{"v":2}',
    });

    const result = await runPublish(
      'signals',
      { type: 'alert' },
      undefined,
      '{"v":2}',
    );

    expect(mockClient.publish).toHaveBeenCalledWith('signals', {
      type: 'alert',
      data: { v: 2 },
    });
    expect(result.id).toBe('evt-5');
  });

  it('--data flag takes precedence over positional arg', async () => {
    writeConfig({ signals: 'pub-tok' });
    mockClient.publish.mockResolvedValueOnce({
      id: 'evt-6',
      channel_id: 'signals',
      data: '{"from":"flag"}',
    });

    await runPublish(
      'signals',
      { data: '{"from":"flag"}' },
      undefined,
      '{"from":"arg"}',
    );

    expect(mockClient.publish).toHaveBeenCalledWith('signals', {
      data: { from: 'flag' },
    });
  });

  it('falls back to admin token when no publish token exists', async () => {
    writeConfig();
    mockClient.publish.mockResolvedValueOnce({ id: 'evt-4' });

    await runPublish('signals', { data: '{}' });
    expect(mockClient.publish).toHaveBeenCalled();
  });

  it('throws on invalid JSON data', async () => {
    writeConfig({ signals: 'pub-tok' });

    await expect(runPublish('signals', { data: 'not json' })).rejects.toThrow(
      'Invalid JSON from --data',
    );
  });
});

describe('publish stream', () => {
  function mockStdin(lines: string[]) {
    const stream = Readable.from(
      lines.map((l) => l + '\n'),
    ) as typeof process.stdin;
    Object.defineProperty(stream, 'isTTY', { value: false });
    const original = process.stdin;
    Object.defineProperty(process, 'stdin', {
      value: stream,
      configurable: true,
    });
    return () => {
      Object.defineProperty(process, 'stdin', {
        value: original,
        configurable: true,
      });
    };
  }

  it('publishes each line as a separate event', async () => {
    writeConfig({ signals: 'pub-tok' });
    let eventNum = 0;
    mockClient.publish.mockImplementation(() =>
      Promise.resolve({ id: `evt-${++eventNum}`, channel_id: 'signals' }),
    );

    const restore = mockStdin(['{"a":1}', '{"b":2}', '{"c":3}']);

    const events: string[] = [];
    const result = await runPublishStream(
      'signals',
      {},
      mockClient as never,
      (event) => events.push(event.id),
    );
    restore();

    expect(result).toEqual({ published: 3, errors: 0 });
    expect(events).toEqual(['evt-1', 'evt-2', 'evt-3']);
    expect(mockClient.publish).toHaveBeenCalledTimes(3);
    expect(mockClient.publish).toHaveBeenNthCalledWith(1, 'signals', {
      data: { a: 1 },
    });
    expect(mockClient.publish).toHaveBeenNthCalledWith(2, 'signals', {
      data: { b: 2 },
    });
    expect(mockClient.publish).toHaveBeenNthCalledWith(3, 'signals', {
      data: { c: 3 },
    });
  });

  it('skips blank lines', async () => {
    writeConfig({ signals: 'pub-tok' });
    mockClient.publish.mockResolvedValue({
      id: 'evt-1',
      channel_id: 'signals',
    });

    const restore = mockStdin(['{"a":1}', '', '  ', '{"b":2}']);
    const result = await runPublishStream('signals', {}, mockClient as never);
    restore();

    expect(result).toEqual({ published: 2, errors: 0 });
    expect(mockClient.publish).toHaveBeenCalledTimes(2);
  });

  it('applies --type to all events', async () => {
    writeConfig({ signals: 'pub-tok' });
    mockClient.publish.mockResolvedValue({
      id: 'evt-1',
      channel_id: 'signals',
    });

    const restore = mockStdin(['{"v":1}', '{"v":2}']);
    await runPublishStream('signals', { type: 'metric' }, mockClient as never);
    restore();

    expect(mockClient.publish).toHaveBeenNthCalledWith(1, 'signals', {
      type: 'metric',
      data: { v: 1 },
    });
    expect(mockClient.publish).toHaveBeenNthCalledWith(2, 'signals', {
      type: 'metric',
      data: { v: 2 },
    });
  });

  it('counts errors and continues on publish failure', async () => {
    writeConfig({ signals: 'pub-tok' });
    mockClient.publish
      .mockResolvedValueOnce({ id: 'evt-1', channel_id: 'signals' })
      .mockRejectedValueOnce(new Error('server error'))
      .mockResolvedValueOnce({ id: 'evt-3', channel_id: 'signals' });

    const restore = mockStdin(['{"a":1}', '{"b":2}', '{"c":3}']);
    const result = await runPublishStream('signals', {}, mockClient as never);
    restore();

    expect(result).toEqual({ published: 2, errors: 1 });
  });
});
