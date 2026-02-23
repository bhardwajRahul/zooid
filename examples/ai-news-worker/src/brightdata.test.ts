import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitScrape, fetchResults } from './brightdata';
import type { RedditPost } from './types';
import fixtures from './fixtures.json';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('submitScrape', () => {
  it('calls /trigger with correct params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapshot_id: 'sd_test123' }),
    });

    const snapshotId = await submitScrape(
      ['ai_agents', 'ClaudeAI'],
      'test-api-key',
      'gd_test_dataset',
      'https://example.com/hooks/brightdata',
    );

    expect(snapshotId).toBe('sd_test123');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/datasets/v3/trigger');
    expect(url).toContain('dataset_id=gd_test_dataset');
    expect(url).toContain(
      'notify=https%3A%2F%2Fexample.com%2Fhooks%2Fbrightdata',
    );
    expect(url).toContain('type=discover_new');
    expect(url).toContain('discover_by=subreddit_url');

    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer test-api-key');

    const body = JSON.parse(options.body);
    expect(body.input).toHaveLength(2);
    expect(body.input[0].url).toBe('https://www.reddit.com/r/ai_agents/');
    expect(body.input[0].sort_by).toBe('Top');
    expect(body.input[1].url).toBe('https://www.reddit.com/r/ClaudeAI/');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(
      submitScrape(['test'], 'bad-key', 'gd_test', 'https://example.com/hook'),
    ).rejects.toThrow('Bright Data scrape submit failed (401): Unauthorized');
  });
});

describe('fetchResults', () => {
  it('fetches snapshot results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => fixtures,
    });

    const results = await fetchResults('sd_test123', 'test-api-key');

    expect(results).toHaveLength(fixtures.length);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/snapshot/sd_test123');
    expect(url).toContain('format=json');
    expect(options.headers.Authorization).toBe('Bearer test-api-key');
  });

  it('returns empty array when response is an object (not an array)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ready', message: 'no data' }),
    });

    const results = await fetchResults('sd_empty', 'test-api-key');
    expect(results).toEqual([]);
  });

  it('unwraps { results: [...] } wrapper', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: fixtures }),
    });

    const results = await fetchResults('sd_wrapped', 'test-api-key');
    expect(results).toHaveLength(fixtures.length);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Snapshot not found',
    });

    await expect(fetchResults('sd_bad', 'key')).rejects.toThrow(
      'Bright Data snapshot fetch failed (404): Snapshot not found',
    );
  });
});
