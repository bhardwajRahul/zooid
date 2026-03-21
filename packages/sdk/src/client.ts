import { ZooidError } from './error';
import { OAuthTokenManager } from './oauth';
import type {
  ZooidClientOptions,
  ServerDiscovery,
  ServerIdentity,
  ChannelInfo,
  CreateChannelOptions,
  CreateChannelResult,
  UpdateChannelOptions,
  MintTokenOptions,
  MintTokenResult,
  ZooidEvent,
  PublishOptions,
  PollOptions,
  PollResult,
  WebhookOptions,
  WebhookResult,
  SubscribeOptions,
  TailOptions,
  TailStream,
  UpdateServerMetaOptions,
  ClaimResult,
  TrustedKey,
  AddKeyOptions,
  TokenClaims,
} from './types';

/**
 * Client for the Zooid pub/sub API.
 *
 * Provides methods for channel management, event publishing/polling,
 * webhook registration, and server metadata access.
 *
 * @example
 * ```ts
 * const client = new ZooidClient({
 *   server: 'https://zooid.example.workers.dev',
 *   token: 'eyJ...',
 * });
 *
 * const channels = await client.listChannels();
 * ```
 */
export class ZooidClient {
  /** Base URL of the Zooid server (trailing slashes stripped). */
  readonly server: string;
  private token?: string;
  private tokenManager?: OAuthTokenManager;
  private _fetch: typeof globalThis.fetch;

  constructor(options: ZooidClientOptions) {
    this.server = options.server.replace(/\/+$/, '');
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);

    if (options.token && options.clientId) {
      throw new Error('Cannot provide both token and clientId');
    }

    if (options.clientId && options.clientSecret) {
      this.tokenManager = new OAuthTokenManager(
        this.server,
        options.clientId,
        options.clientSecret,
        this._fetch,
        options.tokenEndpoint,
      );
    } else {
      this.token = options.token;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {};

    const token = this.tokenManager
      ? await this.tokenManager.getToken()
      : this.token;

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let res: Response;
    try {
      res = await this._fetch(this.server + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new ZooidError(
        0,
        `Cannot connect to ${this.server} — ${err instanceof Error ? err.message : 'network error'}`,
      );
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const json = (await res.json()) as Record<string, unknown>;
        if (json.error) message = String(json.error);
      } catch {
        // use default message
      }
      throw new ZooidError(res.status, message);
    }

    if (res.status === 204) {
      return undefined as T;
    }

    return res.json() as Promise<T>;
  }

  /** Fetch server discovery metadata from `GET /.well-known/zooid.json`. */
  async getMetadata(): Promise<ServerDiscovery> {
    return this.request<ServerDiscovery>('GET', '/.well-known/zooid.json');
  }

  /** Fetch editable server identity from `GET /api/v1/server`. */
  async getServerMeta(): Promise<ServerIdentity> {
    return this.request<ServerIdentity>('GET', '/api/v1/server');
  }

  /** Update server identity metadata via `PUT /api/v1/server`. Requires admin token. */
  async updateServerMeta(
    options: UpdateServerMetaOptions,
  ): Promise<ServerIdentity> {
    return this.request<ServerIdentity>('PUT', '/api/v1/server', options);
  }

  /** List all channels via `GET /api/v1/channels`. */
  async listChannels(): Promise<ChannelInfo[]> {
    const res = await this.request<{ channels: ChannelInfo[] }>(
      'GET',
      '/api/v1/channels',
    );
    return res.channels;
  }

  /** Create a new channel via `POST /api/v1/channels`. Requires admin token. */
  async createChannel(
    options: CreateChannelOptions,
  ): Promise<CreateChannelResult> {
    return this.request<CreateChannelResult>(
      'POST',
      '/api/v1/channels',
      options,
    );
  }

  /** Update an existing channel via `PATCH /api/v1/channels/:id`. Requires admin token. */
  async updateChannel(
    channelId: string,
    options: UpdateChannelOptions,
  ): Promise<ChannelInfo> {
    return this.request<ChannelInfo>(
      'PATCH',
      `/api/v1/channels/${channelId}`,
      options,
    );
  }

  /** Generate a signed claim for the Zooid Directory. Requires admin token. */
  async getClaim(channels: string[], action?: 'delete'): Promise<ClaimResult> {
    const body: Record<string, unknown> = { channels };
    if (action) body.action = action;
    return this.request<ClaimResult>('POST', '/api/v1/directory/claim', body);
  }

  /** Get the claims of the current token. */
  async getTokenClaims(): Promise<TokenClaims> {
    return this.request<TokenClaims>('GET', '/api/v1/tokens/claims');
  }

  /** Mint a new token. Requires admin token. */
  async mintToken(options: MintTokenOptions): Promise<MintTokenResult> {
    return this.request<MintTokenResult>('POST', '/api/v1/tokens', options);
  }

  /** List roles configured on the server. Requires admin token. */
  async listRoles(): Promise<
    Array<{ id: string; name?: string; description?: string; scopes: string[] }>
  > {
    const res = await this.request<{
      roles: Array<{
        id: string;
        name?: string;
        description?: string;
        scopes: string[];
      }>;
    }>('GET', '/api/v1/roles');
    return res.roles;
  }

  /** List trusted signing keys. Requires admin token. */
  async listKeys(): Promise<TrustedKey[]> {
    const res = await this.request<{ keys: TrustedKey[] }>(
      'GET',
      '/api/v1/keys',
    );
    return res.keys;
  }

  /** Add a trusted signing key. Requires admin token. */
  async addKey(options: AddKeyOptions): Promise<TrustedKey> {
    return this.request<TrustedKey>('POST', '/api/v1/keys', options);
  }

  /** Revoke a trusted signing key. Requires admin token. */
  async revokeKey(kid: string): Promise<void> {
    await this.request<{ ok: boolean }>(
      'DELETE',
      `/api/v1/keys/${encodeURIComponent(kid)}`,
    );
  }

  /** Delete a channel and all its data. Requires admin token. */
  async deleteChannel(channelId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/v1/channels/${channelId}`);
  }

  /** Delete a single event by ID. Requires admin or publish token. */
  async deleteEvent(channelId: string, eventId: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/api/v1/channels/${channelId}/events/${eventId}`,
    );
  }

  /** Publish a single event to a channel. Requires a publish-scoped token. */
  async publish(
    channelId: string,
    options: PublishOptions,
  ): Promise<ZooidEvent> {
    const body: Record<string, unknown> = { data: options.data };
    if (options.type !== undefined) {
      body.type = options.type;
    }
    if (options.reply_to !== undefined) {
      body.reply_to = options.reply_to;
    }
    if (options.meta !== undefined) {
      body.meta = options.meta;
    }
    return this.request<ZooidEvent>(
      'POST',
      `/api/v1/channels/${channelId}/events`,
      body,
    );
  }

  /** Publish multiple events in a single request. Requires a publish-scoped token. */
  async publishBatch(
    channelId: string,
    events: PublishOptions[],
  ): Promise<ZooidEvent[]> {
    const body = {
      events: events.map((e) => {
        const item: Record<string, unknown> = { data: e.data };
        if (e.type !== undefined) item.type = e.type;
        if (e.meta !== undefined) item.meta = e.meta;
        return item;
      }),
    };
    const res = await this.request<{ events: ZooidEvent[] }>(
      'POST',
      `/api/v1/channels/${channelId}/events`,
      body,
    );
    return res.events;
  }

  /**
   * Fetch events from a channel.
   *
   * Without `follow`, performs a one-shot poll (alias for {@link poll}).
   * With `follow: true`, returns an async iterable stream that wraps {@link subscribe}.
   *
   * @example
   * ```ts
   * // One-shot
   * const result = await client.tail('my-channel', { limit: 10 });
   *
   * // Follow mode
   * const stream = client.tail('my-channel', { follow: true });
   * for await (const event of stream) {
   *   console.log(event);
   * }
   * ```
   */
  tail(channelId: string, options: TailOptions & { follow: true }): TailStream;
  tail(channelId: string, options?: TailOptions): Promise<PollResult>;
  tail(
    channelId: string,
    options?: TailOptions,
  ): Promise<PollResult> | TailStream {
    if (options?.follow) {
      return this.createTailStream(channelId, options);
    }
    return this.poll(channelId, options);
  }

  private createTailStream(
    channelId: string,
    options: TailOptions,
  ): TailStream {
    const buffer: ZooidEvent[] = [];
    let waiting: ((result: IteratorResult<ZooidEvent>) => void) | null = null;
    let done = false;
    let unsub: (() => void) | null = null;

    this.subscribe(
      channelId,
      (event) => {
        if (waiting) {
          const resolve = waiting;
          waiting = null;
          resolve({ value: event, done: false });
        } else {
          buffer.push(event);
        }
      },
      {
        mode: options.mode,
        interval: options.interval,
        type: options.type,
      },
    ).then((fn) => {
      unsub = fn;
      if (done) fn();
    });

    const stream: TailStream = {
      close() {
        done = true;
        unsub?.();
        if (waiting) {
          waiting({ value: undefined as unknown as ZooidEvent, done: true });
          waiting = null;
        }
      },
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<ZooidEvent>> {
            if (buffer.length > 0) {
              return Promise.resolve({ value: buffer.shift()!, done: false });
            }
            if (done) {
              return Promise.resolve({
                value: undefined as unknown as ZooidEvent,
                done: true,
              });
            }
            return new Promise((resolve) => {
              waiting = resolve;
            });
          },
          return(): Promise<IteratorResult<ZooidEvent>> {
            stream.close();
            return Promise.resolve({
              value: undefined as unknown as ZooidEvent,
              done: true,
            });
          },
        };
      },
    };

    return stream;
  }

  /** Poll events from a channel with cursor-based pagination. */
  async poll(channelId: string, options?: PollOptions): Promise<PollResult> {
    const params = new URLSearchParams();
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit !== undefined)
      params.set('limit', String(options.limit));
    if (options?.type) params.set('type', options.type);
    if (options?.since) params.set('since', options.since);

    const qs = params.toString();
    const path = `/api/v1/channels/${channelId}/events${qs ? `?${qs}` : ''}`;
    return this.request<PollResult>('GET', path);
  }

  /** Register a webhook to receive events via POST. */
  async registerWebhook(
    channelId: string,
    url: string,
    options?: WebhookOptions,
  ): Promise<WebhookResult> {
    return this.request<WebhookResult>(
      'POST',
      `/api/v1/channels/${channelId}/webhooks`,
      {
        url,
        ...options,
      },
    );
  }

  /** Remove a webhook registration. Requires admin token. */
  async removeWebhook(channelId: string, webhookId: string): Promise<void> {
    await this.request<void>(
      'DELETE',
      `/api/v1/channels/${channelId}/webhooks/${webhookId}`,
    );
  }

  /**
   * Subscribe to a channel. Tries WebSocket first (mode `'auto'`), falls back to polling.
   *
   * Returns a promise that resolves with an unsubscribe function.
   *
   * @example
   * ```ts
   * const unsub = await client.subscribe('my-channel', (event) => {
   *   console.log('New event:', event.id);
   * });
   *
   * // Later: stop
   * unsub();
   * ```
   */
  async subscribe(
    channelId: string,
    callback: (event: ZooidEvent) => void,
    options?: SubscribeOptions,
  ): Promise<() => void> {
    const mode = options?.mode ?? 'auto';

    if (mode === 'poll') {
      return this.startPolling(channelId, callback, options);
    }

    let stopped = false;
    let activeWs: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = () => {
      stopped = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (activeWs) {
        activeWs.onclose = null;
        activeWs.onerror = null;
        activeWs.close();
        activeWs = null;
      }
    };

    const scheduleReconnect = (attempt: number) => {
      if (stopped) return;
      // Exponential backoff: 1s, 2s, 4s, 8s, …, capped at 30s
      const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!stopped) connectWs(attempt + 1);
      }, delay);
    };

    const connectWs = async (attempt: number) => {
      if (stopped) return;
      const url = await this.buildWsUrl(channelId, options);
      const ws = new globalThis.WebSocket(url);
      activeWs = ws;

      ws.onopen = () => {
        attempt = 0;
      };

      ws.onmessage = (e: MessageEvent) => {
        try {
          const event = JSON.parse(String(e.data)) as ZooidEvent;
          callback(event);
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        activeWs = null;
        scheduleReconnect(attempt);
      };

      ws.onerror = () => {
        // Don't call ws.close() — onclose fires automatically after onerror
      };
    };

    // Initial connection: retry once on failure, then fallback (auto) or reject (ws)
    const tryWs = async (retryOnFail: boolean): Promise<() => void> => {
      const url = await this.buildWsUrl(channelId, options);
      return new Promise<() => void>((resolve, reject) => {
        const ws = new globalThis.WebSocket(url);
        activeWs = ws;

        ws.onopen = () => {
          // Initial connection succeeded — wire up auto-reconnect handlers
          ws.onmessage = (e: MessageEvent) => {
            try {
              const event = JSON.parse(String(e.data)) as ZooidEvent;
              callback(event);
            } catch {
              // ignore non-JSON messages
            }
          };

          ws.onclose = () => {
            if (stopped) return;
            activeWs = null;
            scheduleReconnect(0);
          };

          ws.onerror = () => {
            // Don't call ws.close() — onclose fires automatically after onerror
          };

          resolve(unsubscribe);
        };

        ws.onerror = () => {
          // Don't call ws.close() — onclose fires automatically after onerror
          if (retryOnFail) {
            // Retry once after 1s
            setTimeout(() => {
              tryWs(false).then(resolve, reject);
            }, 1000);
          } else if (mode === 'auto') {
            // Fall back to polling
            this.startPolling(channelId, callback, options).then(
              resolve,
              reject,
            );
          } else {
            // mode: 'ws' — reject
            reject(new Error('WebSocket connection failed'));
          }
        };
      });
    };

    return tryWs(true);
  }

  private async buildWsUrl(
    channelId: string,
    options?: SubscribeOptions,
  ): Promise<string> {
    const base = this.server
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://');
    const params = new URLSearchParams();
    const token = this.tokenManager
      ? await this.tokenManager.getToken()
      : this.token;
    if (token) params.set('token', token);
    if (options?.type) params.set('types', options.type);
    const qs = params.toString();
    return `${base}/api/v1/channels/${channelId}/ws${qs ? `?${qs}` : ''}`;
  }

  private startPolling(
    channelId: string,
    callback: (event: ZooidEvent) => void,
    options?: SubscribeOptions,
  ): Promise<() => void> {
    const interval = options?.interval ?? 5000;
    const type = options?.type;
    let cursor: string | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const doPoll = async () => {
      try {
        const pollOpts: PollOptions = {};
        if (cursor) pollOpts.cursor = cursor;
        if (type) pollOpts.type = type;
        const result = await this.poll(channelId, pollOpts);
        if (stopped) return;
        for (const event of result.events) {
          callback(event);
        }
        if (result.cursor) {
          cursor = result.cursor;
        }
      } catch {
        // silently swallow errors, keep polling
      }
    };

    // Immediate first poll
    doPoll();

    // Set up interval for subsequent polls
    timer = setInterval(doPoll, interval);

    // Return unsubscribe function
    return Promise.resolve(() => {
      stopped = true;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    });
  }
}
