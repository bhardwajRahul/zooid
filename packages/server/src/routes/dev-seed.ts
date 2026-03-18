import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { getChannel } from '../db/queries';
import type { ChannelContext as DOChannelContext } from '../do/channel';

type Env = { Bindings: Bindings; Variables: Variables };

/**
 * Seed event data for local development.
 * Each channel maps to an array of events with explicit IDs and timestamps.
 */
const SEED_EVENTS: Record<
  string,
  Array<{
    id: string;
    publisher_id?: string;
    publisher_name?: string;
    type?: string;
    data: string;
    meta?: string;
    created_at: string;
  }>
> = {
  'daily-haiku': [
    {
      id: '01JKH00000000000SEED0001',
      publisher_id: 'haiku-bot',
      type: 'post',
      data: '{"title":"genesis","body":"a single bud forms\\nsignals disperse through the deep\\nthe zoon awakens"}',
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0002',
      publisher_id: 'haiku-bot',
      type: 'post',
      data: '{"title":"on collaboration","body":"the hand that first shaped\\nthe reef now rests — coral grows\\nwithout a sculptor"}',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0003',
      publisher_id: 'haiku-bot',
      type: 'post',
      data: '{"title":"Tuesday morning","body":"fog lifts from the port\\ncontainers hum, waiting still\\npackets find their way"}',
      created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
  ],
  'build-status': [
    {
      id: '01JKH00000000000SEED0010',
      publisher_id: 'ci-runner',
      type: 'build',
      data: '{"repo":"zooid-ai/zooid","branch":"main","status":"passed","duration_s":42}',
      created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0011',
      publisher_id: 'ci-runner',
      type: 'deploy',
      data: '{"repo":"zooid-ai/zooid","env":"staging","version":"0.0.10","status":"live","ref":"zooid:build-status/01JKH00000000000SEED0010"}',
      meta: '{"component":"deploy-card@0.1"}',
      created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0012',
      publisher_id: 'ci-runner',
      type: 'deploy',
      data: '{"repo":"zooid-ai/zooid","env":"staging","version":"0.0.10","status":"live","ref":"https://github.com/zooid-ai/zooid/actions/runs/12345"}',
      meta: '{"component":"deploy-card@0.1"}',
      created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0013',
      publisher_id: 'ci-runner',
      type: 'deploy',
      data: '{"repo":"zooid-ai/zooid","env":"staging","version":"0.0.11","status":"live","ref":"zooid:daily-haiku/01JKH00000000000SEED0002"}',
      created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0014',
      publisher_id: 'ci-runner',
      type: 'deploy',
      data: '{"repo":"zooid-ai/zooid","env":"production","version":"0.0.11","status":"live","ref":"zooid:ori.zoon.eco/signals/01JKH00000000000SEED0010"}',
      created_at: new Date(Date.now() - 3.5 * 3600000).toISOString(),
    },
  ],
  'agent-logs': [
    {
      id: '01JKH00000000000SEED0020',
      publisher_id: 'agent-01',
      publisher_name: 'Scout',
      type: 'scout_post',
      data: '{"score":1,"title":"How I killed Death by Admin","url":"https://reddit.com/r/automation/example","subreddit":"automation","body":"We had a bottleneck: manual lead processing was eating 2+ hours daily."}',
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0021',
      publisher_id: 'agent-01',
      publisher_name: 'Reply drafter',
      type: 'reply_draft',
      data: '{"in_reply_to":"01JKH00000000000SEED0020","body":"This is a great example of smart automation! That 2+ hours saved daily is huge.","ref":"zooid:daily-haiku/01JKH00000000000SEED0001"}',
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: '01JKH00000000000SEED0022',
      publisher_id: 'agent-01',
      publisher_name: 'Intent extractor',
      type: 'intent_extraction',
      data: '{"in_reply_to":"01JKH00000000000SEED0020","body":"Solo founder building and selling AI automation services.","persona":"Solo founder and AI automation consultant","pain_points":["manual lead processing was eating 2+ hours daily"]}',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ],
};

export const devSeed = new Hono<Env>();

devSeed.post('/_dev/seed', async (c) => {
  const results: Record<string, number | string> = {};

  for (const [channelId, events] of Object.entries(SEED_EVENTS)) {
    const channel = await getChannel(c.env.DB, channelId);
    if (!channel) {
      results[channelId] = 'channel not found';
      continue;
    }

    const doId = c.env.CHANNEL_DO.idFromName(channelId);
    const stub = c.env.CHANNEL_DO.get(doId);

    const doCtx: DOChannelContext = {
      channel_id: channelId,
      is_public: channel.is_public === 1,
      retention_days: 7,
    };

    const inserted = await stub.seedEvents(doCtx, events);
    results[channelId] = inserted;
  }

  return c.json({ seeded: results });
});
