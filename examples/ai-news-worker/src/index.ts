import type { Env } from './types';
import { submitScrape, fetchResults } from './brightdata';
import { filterPosts, generateDigest } from './digest';
import { publishDigest } from './publish';

const WORKER_URL = 'https://ai-news-worker.beno-87a.workers.dev';

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const subreddits = env.SUBREDDITS.split(',');
    const callbackUrl = `${WORKER_URL}/hooks/brightdata`;

    const snapshotId = await submitScrape(
      subreddits,
      env.BRIGHTDATA_API_KEY,
      env.BRIGHTDATA_DATASET_ID,
      callbackUrl,
    );

    await env.KV.put('latest_snapshot', snapshotId, { expirationTtl: 86400 });
    console.log(`Scrape submitted: snapshot_id=${snapshotId}`);
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/hooks/brightdata' && request.method === 'POST') {
      // Bright Data sends the snapshot_id in the callback body
      const body = (await request.json()) as { snapshot_id: string };
      const snapshotId = body.snapshot_id;

      // Process in the background so we respond to Bright Data quickly
      ctx.waitUntil(processDigest(snapshotId, env));

      return new Response('ok', { status: 200 });
    }

    return new Response('not found', { status: 404 });
  },
};

async function processDigest(snapshotId: string, env: Env): Promise<void> {
  const subreddits = env.SUBREDDITS.split(',');
  const date = new Date().toISOString().slice(0, 10);

  // Fetch scrape results
  const allPosts = await fetchResults(snapshotId, env.BRIGHTDATA_API_KEY);
  console.log(`Fetched ${allPosts.length} posts from Bright Data`);

  // Filter to top 10 text posts
  const topPosts = filterPosts(allPosts);
  if (topPosts.length === 0) {
    console.log('No qualifying posts found, skipping digest');
    return;
  }
  console.log(`Filtered to ${topPosts.length} posts`);

  // Generate AI digest
  const { digest, digestPosts } = await generateDigest(env.AI, topPosts, date);

  // Publish to zooid
  await publishDigest(env, {
    date,
    subreddits,
    post_count: digestPosts.length,
    digest,
    posts: digestPosts,
  });

  console.log(`Published ai-news digest for ${date}`);
}
