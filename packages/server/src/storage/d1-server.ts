import type { Channel, TrustedKeyRow, ServerIdentity } from '../types';
import type { ChannelListItem } from '@zooid/types';
import type {
  ServerStorage,
  CreateChannelInput,
  UpdateChannelInput,
  AddTrustedKeyInput,
} from './server-types';
import {
  createChannel,
  getChannel,
  listChannels,
  updateChannel,
  deleteChannelRecord,
  getServerMeta,
  upsertServerMeta,
  listTrustedKeys,
  getTrustedKey,
  addTrustedKey,
  removeTrustedKey,
} from '../db/queries';

/**
 * ServerStorage backed by a single-tenant D1 database.
 * Thin wrapper around existing queries.ts functions.
 */
export class D1ServerStorage implements ServerStorage {
  constructor(private db: D1Database) {}

  async createChannel(input: CreateChannelInput): Promise<Channel> {
    return createChannel(this.db, input);
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    return getChannel(this.db, channelId);
  }

  async listChannels(): Promise<ChannelListItem[]> {
    return listChannels(this.db);
  }

  async updateChannel(
    channelId: string,
    input: UpdateChannelInput,
  ): Promise<Channel | null> {
    return updateChannel(this.db, channelId, input);
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    return deleteChannelRecord(this.db, channelId);
  }

  async getServerMeta(): Promise<ServerIdentity | null> {
    return getServerMeta(this.db);
  }

  async upsertServerMeta(meta: {
    name?: string;
    description?: string | null;
    tags?: string[];
    owner?: string | null;
    company?: string | null;
    email?: string | null;
  }): Promise<ServerIdentity> {
    return upsertServerMeta(this.db, meta);
  }

  async listTrustedKeys(): Promise<TrustedKeyRow[]> {
    return listTrustedKeys(this.db);
  }

  async getTrustedKey(kid: string): Promise<TrustedKeyRow | null> {
    return getTrustedKey(this.db, kid);
  }

  async addTrustedKey(input: AddTrustedKeyInput): Promise<TrustedKeyRow> {
    return addTrustedKey(this.db, input);
  }

  async removeTrustedKey(kid: string): Promise<boolean> {
    return removeTrustedKey(this.db, kid);
  }
}
