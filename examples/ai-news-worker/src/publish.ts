import { ZooidClient } from '@zooid/sdk';
import type { Env, AiNewsEvent } from './types';

/**
 * Publish the daily digest to the ai-news channel on the Zooid server.
 */
export async function publishDigest(
  env: Env,
  event: AiNewsEvent,
): Promise<void> {
  const client = new ZooidClient({
    server: env.ZOOID_SERVER,
    token: env.ZOOID_PUBLISH_TOKEN,
  });

  await client.publish('ai-news', {
    type: 'daily-digest',
    data: event,
  });
}
