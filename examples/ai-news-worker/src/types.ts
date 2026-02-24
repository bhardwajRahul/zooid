export interface Env {
  AI: Ai;
  KV: KVNamespace;
  BRIGHTDATA_API_KEY: string;
  BRIGHTDATA_DATASET_ID: string;
  ZOOID_SERVER: string;
  ZOOID_PUBLISH_TOKEN: string;
  SUBREDDITS: string;
  WORKER_URL: string;
}

/** Raw post from Bright Data reddit scraper response. */
export interface RedditPost {
  post_id: string;
  url: string;
  user_posted: string;
  title: string;
  description: string | null;
  num_comments: number;
  date_posted: string;
  community_name: string;
  num_upvotes: number;
  photos: string[] | null;
  videos: string[] | null;
  tag: string | null;
  embedded_links: string[] | null;
}

/** Filtered + summarized post for the digest. */
export interface DigestPost {
  title: string;
  url: string;
  subreddit: string;
  score: number;
  comment_count: number;
  summary: string;
}

/** Event data published to the ai-news channel. */
export interface AiNewsEvent {
  date: string;
  subreddits: string[];
  post_count: number;
  digest: string;
  posts: DigestPost[];
}
