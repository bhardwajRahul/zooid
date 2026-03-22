import fs from 'node:fs';
import readline from 'node:readline';
import { ZooidClient } from '@zooid/sdk';
import type { ZooidEvent } from '@zooid/types';
import { createPublishClient } from '../lib/client';

export interface PublishCommandOptions {
  type?: string;
  data?: string;
  file?: string;
  stream?: boolean;
}

function parseJSON(raw: string, source: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON from ${source}: ${raw.slice(0, 100)}`);
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      reject(
        new Error(
          'No data provided. Usage: zooid publish <channel> <json> or pipe via stdin',
        ),
      );
      return;
    }
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () =>
      resolve(Buffer.concat(chunks).toString('utf-8').trim()),
    );
    process.stdin.on('error', reject);
  });
}

export async function runPublish(
  channelId: string,
  options: PublishCommandOptions,
  client?: ZooidClient,
  dataArg?: string,
): Promise<ZooidEvent> {
  const c = client ?? createPublishClient(channelId);

  let type: string | undefined;
  let data: unknown;

  if (options.file) {
    const raw = fs.readFileSync(options.file, 'utf-8');
    const parsed = parseJSON(raw, options.file);
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
      const obj = parsed as Record<string, unknown>;
      type = obj.type as string;
      data = obj.data ?? parsed;
    } else {
      data = parsed;
    }
  } else if (options.data) {
    data = parseJSON(options.data, '--data');
    type = options.type;
  } else if (dataArg) {
    data = parseJSON(dataArg, 'argument');
    type = options.type;
  } else {
    const raw = await readStdin();
    data = parseJSON(raw, 'stdin');
    type = options.type;
  }

  const publishOpts: { type?: string; data: unknown } = { data };
  if (type) publishOpts.type = type;

  return c.publish(channelId, publishOpts);
}

export async function runPublishStream(
  channelId: string,
  options: PublishCommandOptions,
  client?: ZooidClient,
  onEvent?: (event: ZooidEvent, line: number) => void,
): Promise<{ published: number; errors: number }> {
  if (process.stdin.isTTY) {
    throw new Error(
      '--stream requires piped input (e.g. cat events.jsonl | zooid publish channel --stream)',
    );
  }

  const c = client ?? createPublishClient(channelId);
  const rl = readline.createInterface({ input: process.stdin });

  let published = 0;
  let errors = 0;
  let lineNum = 0;

  for await (const line of rl) {
    lineNum++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    const data = parseJSON(trimmed, `stdin line ${lineNum}`);
    const publishOpts: { type?: string; data: unknown } = { data };
    if (options.type) publishOpts.type = options.type;

    try {
      const event = await c.publish(channelId, publishOpts);
      published++;
      onEvent?.(event, lineNum);
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Line ${lineNum}: ${msg}\n`);
    }
  }

  return { published, errors };
}
