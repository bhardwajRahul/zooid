import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishDigest } from './publish';
import type { Env, AiNewsEvent } from './types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

const mockEnv = {
  ZOOID_SERVER: 'https://beno.zooid.dev',
  ZOOID_PUBLISH_TOKEN: 'test-token',
} as unknown as Env;

const mockEvent: AiNewsEvent = {
  date: '2026-02-22',
  subreddits: ['ai_agents', 'ClaudeAI', 'LocalLLaMA'],
  post_count: 2,
  digest: '## AI News\n\n- Post 1\n- Post 2',
  posts: [
    {
      title: 'Post 1',
      url: 'https://reddit.com/r/test/1',
      subreddit: 'ClaudeAI',
      score: 100,
      comment_count: 10,
      summary: 'Summary 1',
    },
    {
      title: 'Post 2',
      url: 'https://reddit.com/r/test/2',
      subreddit: 'LocalLLaMA',
      score: 50,
      comment_count: 5,
      summary: 'Summary 2',
    },
  ],
};

describe('publishDigest', () => {
  it('publishes to ai-news channel via ZooidClient', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: '01TEST',
        channel_id: 'ai-news',
        type: 'daily-digest',
        data: JSON.stringify(mockEvent),
        publisher_id: null,
        created_at: '2026-02-22T08:00:00Z',
      }),
    });

    await publishDigest(mockEnv, mockEvent);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://beno.zooid.dev/api/v1/channels/ai-news/events');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-token');

    const body = JSON.parse(options.body);
    expect(body.type).toBe('daily-digest');
    expect(body.data.date).toBe('2026-02-22');
    expect(body.data.posts).toHaveLength(2);
  });

  it('throws on publish failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'Forbidden' }),
    });

    await expect(publishDigest(mockEnv, mockEvent)).rejects.toThrow('Forbidden');
  });
});
