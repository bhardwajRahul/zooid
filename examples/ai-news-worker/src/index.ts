import type { Env } from './types';
import { submitScrape, fetchResults } from './brightdata';
import { filterPosts, generateDigest } from './digest';
import { publishDigest } from './publish';

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const subreddits = env.SUBREDDITS.split(',');
    const callbackUrl = `${env.WORKER_URL}/hooks/brightdata`;

    const snapshotId = await submitScrape(
      subreddits,
      env.BRIGHTDATA_API_KEY,
      env.BRIGHTDATA_DATASET_ID,
      callbackUrl,
    );

    await env.KV.put('latest_snapshot', snapshotId, { expirationTtl: 86400 });
    console.log(`Scrape submitted: snapshot_id=${snapshotId}`);
  },

  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/hooks/brightdata' && request.method === 'POST') {
      const body = (await request.json()) as { snapshot_id: string };
      const snapshotId = body.snapshot_id;

      // Verify this snapshot_id matches one we actually triggered
      const expectedId = await env.KV.get('latest_snapshot');
      if (!expectedId || snapshotId !== expectedId) {
        console.log(`Rejected callback: unknown snapshot_id=${snapshotId}`);
        return new Response('not found', { status: 404 });
      }

      await env.KV.delete('latest_snapshot');
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
