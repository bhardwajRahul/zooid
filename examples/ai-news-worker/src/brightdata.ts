import type { RedditPost } from './types';

const BRIGHTDATA_API = 'https://api.brightdata.com/datasets/v3';

/**
 * Submit a scrape job to Bright Data for the given subreddits.
 * Returns the snapshot_id to poll/receive via callback.
 */
export async function submitScrape(
  subreddits: string[],
  apiKey: string,
  datasetId: string,
  callbackUrl: string,
): Promise<string> {
  const input = subreddits.map((sub) => ({
    url: `https://www.reddit.com/r/${sub}/`,
    sort_by: 'Top',
    sort_by_time: 'Today',
    keyword: '',
    start_date: '',
  }));

  const url = new URL(`${BRIGHTDATA_API}/trigger`);
  url.searchParams.set('dataset_id', datasetId);
  url.searchParams.set('notify', callbackUrl);
  url.searchParams.set('include_errors', 'true');
  url.searchParams.set('type', 'discover_new');
  url.searchParams.set('discover_by', 'subreddit_url');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Bright Data scrape submit failed (${res.status}): ${body}`,
    );
  }

  const data = (await res.json()) as { snapshot_id: string };
  return data.snapshot_id;
}

/**
 * Fetch completed scrape results by snapshot ID.
 */
export async function fetchResults(
  snapshotId: string,
  apiKey: string,
): Promise<RedditPost[]> {
  const url = `${BRIGHTDATA_API}/snapshot/${snapshotId}?format=json`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Bright Data snapshot fetch failed (${res.status}): ${body}`,
    );
  }

  const data = await res.json();

  // Bright Data may return an object wrapper instead of a bare array
  // (e.g. when a subreddit has no posts or returns an error entry)
  if (Array.isArray(data)) {
    return data as RedditPost[];
  }
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as Record<string, unknown>).results)
  ) {
    return (data as Record<string, unknown>).results as RedditPost[];
  }

  console.warn(
    `Unexpected snapshot response shape for ${snapshotId}:`,
    JSON.stringify(data).slice(0, 500),
  );
  return [];
}
