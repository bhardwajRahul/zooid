import type { RedditPost, DigestPost } from './types';

const MAX_POSTS = 10;
const MIN_TEXT_LENGTH = 500;

/**
 * Filter to top posts by score that have substantial text content.
 */
export function filterPosts(posts: RedditPost[]): RedditPost[] {
  return posts
    .filter((p) => p.description && p.description.length >= MIN_TEXT_LENGTH)
    .sort((a, b) => b.num_upvotes - a.num_upvotes)
    .slice(0, MAX_POSTS);
}

/**
 * Generate a bulleted markdown digest using Cloudflare Workers AI.
 * Returns the digest string and per-post summaries.
 */
export async function generateDigest(
  ai: Ai,
  posts: RedditPost[],
  date: string,
): Promise<{ digest: string; digestPosts: DigestPost[] }> {
  const postList = posts
    .map(
      (p, i) =>
        `${i + 1}. [r/${p.community_name}] "${p.title}" (score: ${p.num_upvotes}, comments: ${p.num_comments})\n${(p.description ?? '').slice(0, 2000)}`,
    )
    .join('\n\n');

  const prompt = `You are a concise tech news editor. Given these top Reddit posts from AI subreddits, produce:

1. A bulleted markdown digest. Each bullet should have:
   - **Post title** (r/subreddit, score pts) — one-sentence summary of the key insight or news.

2. After the digest, output a JSON array of per-post summaries in this exact format:
\`\`\`json
[{"index": 0, "summary": "one-line summary"}, ...]
\`\`\`

Posts:

${postList}

Output the digest first (markdown), then the JSON block. Keep summaries under 150 characters each. No preamble.`;

  const res = (await ai.run('@cf/meta/llama-3-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
  })) as { response: string };

  const output = res.response;

  // Split digest markdown from the JSON summaries block
  const jsonMatch = output.match(/```json\s*([\s\S]*?)```/);
  const digest = jsonMatch
    ? output.slice(0, jsonMatch.index).trim()
    : output.trim();

  let summaries: { index: number; summary: string }[] = [];
  if (jsonMatch) {
    try {
      summaries = JSON.parse(jsonMatch[1]);
    } catch {
      // Fall back to using titles as summaries
    }
  }

  const digestPosts: DigestPost[] = posts.map((p, i) => ({
    title: p.title,
    url: p.url,
    subreddit: p.community_name,
    score: p.num_upvotes,
    comment_count: p.num_comments,
    summary: summaries.find((s) => s.index === i)?.summary ?? p.title,
  }));

  // Prepend date header to digest
  const fullDigest = `## AI News — ${date}\n\n${digest}`;

  return { digest: fullDigest, digestPosts };
}
