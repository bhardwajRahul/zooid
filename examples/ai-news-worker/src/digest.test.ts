import { describe, it, expect } from 'vitest';
import { filterPosts } from './digest';
import type { RedditPost } from './types';
import fixtures from './fixtures.json';

const posts = fixtures as unknown as RedditPost[];

describe('filterPosts', () => {
  it('filters out posts with description < 500 chars', () => {
    const result = filterPosts(posts);
    const ids = result.map((p) => p.post_id);
    expect(ids).not.toContain('t3_short_text');
    expect(ids).not.toContain('t3_image_post');
    expect(ids).not.toContain('t3_null_description');
  });

  it('keeps posts with description >= 500 chars', () => {
    const result = filterPosts(posts);
    const ids = result.map((p) => p.post_id);
    expect(ids).toContain('t3_long_text_high_score');
    expect(ids).toContain('t3_long_text_low_score');
  });

  it('sorts by num_upvotes descending', () => {
    const result = filterPosts(posts);
    expect(result[0].post_id).toBe('t3_long_text_high_score');
    expect(result[1].post_id).toBe('t3_long_text_low_score');
  });

  it('limits to 10 posts', () => {
    // Create 15 qualifying posts
    const manyPosts: RedditPost[] = Array.from({ length: 15 }, (_, i) => ({
      post_id: `t3_post_${i}`,
      url: `https://reddit.com/r/test/comments/${i}`,
      user_posted: `user_${i}`,
      title: `Post ${i}`,
      description: 'x'.repeat(600),
      num_comments: 10,
      date_posted: '2026-02-21T00:00:00.000Z',
      community_name: 'test',
      num_upvotes: 100 - i,
      photos: null,
      videos: null,
      tag: null,
      embedded_links: null,
    }));

    const result = filterPosts(manyPosts);
    expect(result).toHaveLength(10);
    expect(result[0].num_upvotes).toBe(100);
    expect(result[9].num_upvotes).toBe(91);
  });

  it('returns empty array when no posts qualify', () => {
    const shortPosts: RedditPost[] = [
      {
        post_id: 't3_1',
        url: 'https://reddit.com/r/test/1',
        user_posted: 'u',
        title: 'Short',
        description: 'too short',
        num_comments: 0,
        date_posted: '2026-02-21T00:00:00.000Z',
        community_name: 'test',
        num_upvotes: 999,
        photos: null,
        videos: null,
        tag: null,
        embedded_links: null,
      },
    ];
    expect(filterPosts(shortPosts)).toHaveLength(0);
  });

  it('handles posts with null description', () => {
    const result = filterPosts(posts);
    const ids = result.map((p) => p.post_id);
    expect(ids).not.toContain('t3_null_description');
  });
});
