import { ZooidClient, type ZooidEvent } from '@zooid/sdk';
import {
  dispatchInboundReplyWithBase,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
  type OpenClawConfig,
  type OutboundReplyPayload,
  type PluginRuntime,
} from 'openclaw/plugin-sdk';
import type {
  ResolvedZooidAccount,
  ZooidProbe,
  ZooidChannelConfig,
} from './types.js';
import { zooidOnboardingAdapter } from './onboarding.js';

function createClientForAccount(account: ResolvedZooidAccount): ZooidClient {
  return new ZooidClient({
    server: account.serverUrl,
    token: account.token,
  });
}

const CHANNEL_ID = 'zooid';
const DEFAULT_ACCOUNT_ID = 'default';
const DEFAULT_POLL_INTERVAL = 5000;

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getZooidSection(cfg: OpenClawConfig): ZooidChannelConfig | undefined {
  return ((cfg as Record<string, unknown>).channels as
    | { zooid?: ZooidChannelConfig }
    | undefined)
    ? (
        (cfg as Record<string, unknown>).channels as
          | { zooid?: ZooidChannelConfig }
          | undefined
      )?.zooid
    : undefined;
}

function listAccountIds(cfg: OpenClawConfig): string[] {
  const section = getZooidSection(cfg);
  if (!section) return [];
  const ids = new Set<string>();
  ids.add(DEFAULT_ACCOUNT_ID);
  if (section.accounts) {
    for (const id of Object.keys(section.accounts)) {
      ids.add(id);
    }
  }
  return [...ids];
}

function resolveAccount(
  cfg: OpenClawConfig,
  accountId?: string | null,
): ResolvedZooidAccount {
  const id = accountId ?? DEFAULT_ACCOUNT_ID;
  const section = getZooidSection(cfg);

  const accountSection =
    id !== DEFAULT_ACCOUNT_ID ? section?.accounts?.[id] : undefined;
  const effective = accountSection ?? section;

  const tokenFromConfig = (effective?.token ?? '').trim();
  const tokenFromEnv = (process.env.ZOOID_TOKEN ?? '').trim();
  const token = tokenFromConfig || tokenFromEnv;
  const tokenSource: ResolvedZooidAccount['tokenSource'] = tokenFromConfig
    ? 'config'
    : tokenFromEnv
      ? 'env'
      : 'none';

  return {
    accountId: id,
    name: effective?.name,
    enabled: effective?.enabled !== false,
    serverUrl: (effective?.serverUrl ?? '').trim(),
    token,
    tokenSource,
    defaultPublishChannel: effective?.defaultPublishChannel,
    subscribeMode: effective?.subscribeMode ?? 'auto',
    pollInterval: effective?.pollInterval ?? DEFAULT_POLL_INTERVAL,
  };
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

async function probeAccount(
  account: ResolvedZooidAccount,
  timeoutMs: number,
): Promise<ZooidProbe> {
  const start = Date.now();
  try {
    const client = createClientForAccount(account);
    const [claims, channels] = await Promise.all([
      client.getTokenClaims(),
      client.listChannels(),
    ]);
    return {
      ok: true,
      serverUrl: account.serverUrl,
      claims,
      channels,
      elapsedMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      serverUrl: account.serverUrl,
      elapsedMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Channel target validation
// ---------------------------------------------------------------------------

const CHANNEL_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

function looksLikeZooidChannelId(input: string): boolean {
  return CHANNEL_ID_RE.test(input);
}

function normalizeTarget(raw: string): string {
  return raw.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Inbound handler (follows IRC pattern using dispatchInboundReplyWithBase)
// ---------------------------------------------------------------------------

async function handleZooidInbound(params: {
  event: ZooidEvent;
  channelId: string;
  account: ResolvedZooidAccount;
  cfg: OpenClawConfig;
  core: { channel: PluginRuntime['channel'] };
  client: ZooidClient;
  log?: {
    info: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
  };
}): Promise<void> {
  const { event, channelId, account, cfg, core, client, log } = params;

  let data: Record<string, unknown>;
  try {
    data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
  } catch {
    return;
  }

  const body = typeof data.body === 'string' ? data.body : '';
  if (!body.trim()) {
    return;
  }

  const senderId = event.publisher_id ?? 'unknown';
  const senderName = event.publisher_name ?? senderId;

  log?.info?.(
    `[${account.accountId}] event ${event.id} on ${channelId} from ${senderId}`,
  );

  const route = core.channel.routing.resolveAgentRoute({
    cfg,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    peer: { kind: 'group', id: channelId },
  });

  const storePath = core.channel.session.resolveStorePath(
    (cfg as unknown as { session?: { store?: string } }).session?.store,
    { agentId: route.agentId },
  );

  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  const formattedBody = core.channel.reply.formatAgentEnvelope({
    channel: 'Zooid',
    from: `${senderName} on ${channelId}`,
    timestamp: Date.parse(event.created_at),
    previousTimestamp,
    envelope: envelopeOptions,
    body,
  });

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: formattedBody,
    RawBody: body,
    CommandBody: body,
    From: `zooid:${channelId}:${senderId}`,
    To: `zooid:${channelId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: 'group',
    ConversationLabel: channelId,
    SenderName: senderName,
    SenderId: senderId,
    GroupSubject: channelId,
    Provider: CHANNEL_ID,
    Surface: CHANNEL_ID,
    MessageSid: event.id,
    ReplyToId: event.reply_to ?? undefined,
    MessageThreadId: event.reply_to ?? undefined,
    Timestamp: Date.parse(event.created_at),
    OriginatingChannel: CHANNEL_ID,
    OriginatingTo: `zooid:${channelId}`,
    CommandAuthorized: true,
  });

  await dispatchInboundReplyWithBase({
    cfg,
    channel: CHANNEL_ID,
    accountId: account.accountId,
    route,
    storePath,
    ctxPayload,
    core,
    deliver: async (payload: OutboundReplyPayload) => {
      const text = formatTextWithAttachmentLinks(
        payload.text,
        resolveOutboundMediaUrls(payload),
      );
      if (!text?.trim()) return;
      log?.info?.(`[${account.accountId}] delivering reply to ${channelId}`);
      await client.publish(channelId, {
        type: 'message',
        reply_to: payload.replyToId,
        data: { body: text },
      });
    },
    onRecordError: (err) => {
      log?.error?.(`[${account.accountId}] session record error: ${err}`);
    },
    onDispatchError: (err, info) => {
      log?.error?.(`[${account.accountId}] ${info.kind} reply failed: ${err}`);
    },
  });
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

/** Active subscriptions keyed by accountId. */
const activeSubscriptions = new Map<string, () => void>();

export const zooidPlugin = {
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: 'Zooid',
    selectionLabel: 'Zooid (Pub/Sub)',
    blurb: 'Zooid pub/sub channel — agents and humans on equal footing',
    docsPath: 'https://github.com/zooid-ai/zooid',
  },
  capabilities: {
    chatTypes: ['channel'] as const,
    reactions: true,
    threads: true,
    media: false,
    polls: false,
    nativeCommands: false,
    blockStreaming: false,
  },
  reload: { configPrefixes: ['channels.zooid'] },
  onboarding: zooidOnboardingAdapter,

  // -------------------------------------------------------------------------
  // Config
  // -------------------------------------------------------------------------
  config: {
    listAccountIds: (cfg: OpenClawConfig) => listAccountIds(cfg),
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) =>
      resolveAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    isConfigured: (account: ResolvedZooidAccount) =>
      Boolean(account.serverUrl && account.token),
    unconfiguredReason: (account: ResolvedZooidAccount) => {
      if (!account.serverUrl) return 'serverUrl not configured';
      if (!account.token) return 'token not configured';
      return 'not configured';
    },
    describeAccount: (account: ResolvedZooidAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: Boolean(account.serverUrl && account.token),
      tokenSource: account.tokenSource,
    }),
    resolveAllowFrom: () => undefined,
    resolveDefaultTo: ({
      cfg,
      accountId,
    }: {
      cfg: OpenClawConfig;
      accountId?: string | null;
    }) => {
      const account = resolveAccount(cfg, accountId);
      return account.defaultPublishChannel;
    },
  },

  // -------------------------------------------------------------------------
  // Pairing
  // -------------------------------------------------------------------------
  pairing: {
    idLabel: 'zooidPublisherId',
    normalizeAllowEntry: (entry: string) => entry.replace(/^zooid:/i, ''),
  },

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------
  messaging: {
    normalizeTarget: (raw: string) => normalizeTarget(raw),
    targetResolver: {
      looksLikeId: (input: string) => looksLikeZooidChannelId(input),
      hint: '<channel-id>',
    },
  },

  // -------------------------------------------------------------------------
  // Directory
  // -------------------------------------------------------------------------
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async (params: {
      cfg: OpenClawConfig;
      accountId?: string | null;
    }) => {
      const account = resolveAccount(params.cfg, params.accountId);
      if (!account.serverUrl || !account.token) return [];
      try {
        const client = createClientForAccount(account);
        const channels = await client.listChannels();
        return channels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: 'group' as const,
        }));
      } catch {
        return [];
      }
    },
  },

  // -------------------------------------------------------------------------
  // Outbound
  // -------------------------------------------------------------------------
  outbound: {
    deliveryMode: 'direct' as const,
    textChunkLimit: 64000,
    sendText: async (ctx: {
      cfg: OpenClawConfig;
      to: string;
      text: string;
      accountId?: string | null;
      replyToId?: string | null;
    }) => {
      const account = resolveAccount(ctx.cfg, ctx.accountId);
      const client = createClientForAccount(account);
      const event = await client.publish(ctx.to, {
        type: 'message',
        reply_to: ctx.replyToId ?? undefined,
        data: { body: ctx.text },
      });
      return { channel: CHANNEL_ID, messageId: event.id };
    },
    sendMedia: async (ctx: {
      cfg: OpenClawConfig;
      to: string;
      text: string;
      mediaUrl: string;
      mediaLocalRoots?: string[];
      accountId?: string | null;
      replyToId?: string | null;
    }) => {
      const account = resolveAccount(ctx.cfg, ctx.accountId);
      const client = createClientForAccount(account);
      const event = await client.publish(ctx.to, {
        type: 'message',
        reply_to: ctx.replyToId ?? undefined,
        data: { body: ctx.text, media: ctx.mediaUrl },
      });
      return { channel: CHANNEL_ID, messageId: event.id };
    },
    sendPayload: async (ctx: {
      cfg: OpenClawConfig;
      to: string;
      text: string;
      payload: { text: string; channelData?: Record<string, unknown> };
      accountId?: string | null;
      replyToId?: string | null;
    }) => {
      const account = resolveAccount(ctx.cfg, ctx.accountId);
      const client = createClientForAccount(account);
      const eventData: Record<string, unknown> = {
        body: ctx.payload.text || ctx.text,
      };
      if (ctx.payload.channelData?.zooid) {
        Object.assign(eventData, ctx.payload.channelData.zooid);
      }
      const event = await client.publish(ctx.to, {
        type: 'message',
        reply_to: ctx.replyToId ?? undefined,
        data: eventData,
      });
      return { channel: CHANNEL_ID, messageId: event.id };
    },
  },

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      configured: false,
      enabled: false,
      running: false,
    },
    probeAccount: async (params: {
      account: ResolvedZooidAccount;
      timeoutMs: number;
    }) => probeAccount(params.account, params.timeoutMs),
    buildAccountSnapshot: (params: {
      account: ResolvedZooidAccount;
      cfg: OpenClawConfig;
      runtime?: { running?: boolean };
      probe?: ZooidProbe;
    }) => {
      const { account, probe, runtime } = params;
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: Boolean(account.serverUrl && account.token),
        running: runtime?.running ?? false,
        serverUrl: account.serverUrl,
        tokenSource: account.tokenSource,
        subscribeMode: account.subscribeMode,
        probe: probe
          ? {
              ok: probe.ok,
              channels: probe.channels?.length ?? 0,
              scopes: probe.claims?.scopes ?? [],
              error: probe.error,
            }
          : undefined,
      };
    },
  },

  // -------------------------------------------------------------------------
  // Gateway
  // -------------------------------------------------------------------------
  gateway: {
    startAccount: async (ctx: {
      cfg: OpenClawConfig;
      accountId: string;
      account: ResolvedZooidAccount;
      runtime: unknown;
      abortSignal: AbortSignal;
      log?: {
        info: (...args: unknown[]) => void;
        warn?: (...args: unknown[]) => void;
        error?: (...args: unknown[]) => void;
        debug?: (...args: unknown[]) => void;
      };
      channelRuntime?: PluginRuntime['channel'];
    }) => {
      const { account, abortSignal, log, channelRuntime } = ctx;
      const client = createClientForAccount(account);

      if (!channelRuntime) {
        log?.error?.(
          `[${account.accountId}] channelRuntime not available, cannot process inbound messages`,
        );
      }

      // Resolve our own publisher_id so we can skip echo.
      let selfPublisherId: string | null = null;
      try {
        const claims = await client.getTokenClaims();
        selfPublisherId = claims.sub ?? null;
      } catch {
        // Non-fatal — we'll process all events including our own.
      }

      // Discover channels we can subscribe to.
      let channels: { id: string; name: string }[];
      try {
        channels = await client.listChannels();
      } catch (err) {
        log?.error?.(
          `[${account.accountId}] failed to list channels: ${err instanceof Error ? err.message : err}`,
        );
        return;
      }

      if (channels.length === 0) {
        log?.info?.(
          `[${account.accountId}] no accessible channels, nothing to subscribe to`,
        );
        return;
      }

      log?.info?.(
        `[${account.accountId}] subscribing to ${channels.length} channel(s): ${channels.map((c) => c.id).join(', ')}`,
      );

      const core = { channel: channelRuntime! };
      const unsubscribers: (() => void)[] = [];

      for (const ch of channels) {
        const unsub = await client.subscribe(
          ch.id,
          (event) => {
            if (selfPublisherId && event.publisher_id === selfPublisherId) {
              return;
            }
            if (event.type !== 'message' || !event.data) {
              return;
            }
            if (!channelRuntime) {
              return;
            }

            handleZooidInbound({
              event,
              channelId: ch.id,
              account,
              cfg: ctx.cfg,
              core,
              client,
              log,
            }).catch((err) => {
              log?.error?.(
                `[${account.accountId}] inbound handler error: ${err instanceof Error ? (err.stack ?? err.message) : err}`,
              );
            });
          },
          {
            mode: account.subscribeMode ?? 'auto',
            interval: account.pollInterval,
            type: 'message',
          },
        );

        unsubscribers.push(unsub);
      }

      const unsubAll = () => {
        for (const unsub of unsubscribers) {
          unsub();
        }
      };

      activeSubscriptions.set(account.accountId, unsubAll);

      // Keep the gateway alive until abort. OpenClaw expects startAccount to
      // return a long-running promise — resolving early signals "stopped".
      await new Promise<void>((resolve) => {
        abortSignal.addEventListener('abort', () => {
          unsubAll();
          activeSubscriptions.delete(account.accountId);
          resolve();
        });
      });
    },

    logoutAccount: async (params: {
      cfg: OpenClawConfig;
      accountId: string;
    }) => {
      const unsub = activeSubscriptions.get(params.accountId);
      if (unsub) {
        unsub();
        activeSubscriptions.delete(params.accountId);
      }
      return { cleared: false, loggedOut: true };
    },
  },

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------
  setup: {
    resolveAccountId: ({ accountId }: { accountId?: string }) =>
      accountId ?? DEFAULT_ACCOUNT_ID,
    validateInput: (params: {
      accountId: string;
      input: { serverUrl?: string; token?: string; useEnv?: boolean };
    }) => {
      if (params.input.useEnv && params.accountId !== DEFAULT_ACCOUNT_ID) {
        return 'ZOOID_TOKEN can only be used for the default account.';
      }
      if (!params.input.useEnv && !params.input.token) {
        return 'Zooid requires a token (or --use-env for ZOOID_TOKEN).';
      }
      if (!params.input.serverUrl) {
        return 'Zooid requires a serverUrl.';
      }
      return null;
    },
    applyAccountConfig: (params: {
      cfg: OpenClawConfig;
      accountId: string;
      input: {
        serverUrl?: string;
        token?: string;
        useEnv?: boolean;
        name?: string;
        defaultPublishChannel?: string;
      };
    }) => {
      const { cfg, accountId, input } = params;
      const cfgAny = cfg as Record<string, unknown>;
      const channels = cfgAny.channels as Record<string, unknown> | undefined;
      const zooid = channels?.zooid as ZooidChannelConfig | undefined;

      if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
          ...cfg,
          channels: {
            ...channels,
            zooid: {
              ...zooid,
              enabled: true,
              ...(input.serverUrl ? { serverUrl: input.serverUrl } : {}),
              ...(input.useEnv
                ? {}
                : input.token
                  ? { token: input.token }
                  : {}),
              ...(input.name ? { name: input.name } : {}),
              ...(input.defaultPublishChannel
                ? { defaultPublishChannel: input.defaultPublishChannel }
                : {}),
            },
          },
        } as OpenClawConfig;
      }
      return {
        ...cfg,
        channels: {
          ...channels,
          zooid: {
            ...zooid,
            enabled: true,
            accounts: {
              ...zooid?.accounts,
              [accountId]: {
                ...zooid?.accounts?.[accountId],
                enabled: true,
                ...(input.serverUrl ? { serverUrl: input.serverUrl } : {}),
                ...(input.token ? { token: input.token } : {}),
                ...(input.name ? { name: input.name } : {}),
                ...(input.defaultPublishChannel
                  ? { defaultPublishChannel: input.defaultPublishChannel }
                  : {}),
              },
            },
          },
        },
      } as OpenClawConfig;
    },
  },
};
