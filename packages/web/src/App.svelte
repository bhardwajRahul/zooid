<script lang="ts">
  import Sidebar from './lib/components/sidebar.svelte';
  import ChannelHeader from './lib/components/channel-header.svelte';
  import EventFeed from './lib/components/event-feed.svelte';
  import MessageBar from './lib/components/message-bar.svelte';
  import AuthModal from './lib/components/auth-modal.svelte';
  import ServerConfigPage from './lib/components/server-config-page.svelte';
  import KeysAndTokensPage from './lib/components/keys-and-tokens-page.svelte';
  import CreateChannelModal from './lib/components/create-channel-modal.svelte';
  import EditChannelModal from './lib/components/edit-channel-modal.svelte';
  import RefSideSheet from './lib/components/ref-side-sheet.svelte';
  import {
    fetchServerMeta,
    createClient,
    refreshAuth,
    authLogout,
    type ChannelInfo,
    type ZooidEvent,
    type TokenClaims,
  } from './lib/api';
  import type { Component } from 'svelte';

  interface SettingsPageExtension {
    slug: string;
    label: string;
    icon?: Component;
    component: Component;
  }

  interface ChannelConfigDefaults {
    storage?: { retention_days?: number };
    strict_types?: boolean;
    types?: Record<string, unknown>;
  }

  type MaybeAsync<T> = T | (() => Promise<T>);

  interface WebExtension {
    settingsPages?: SettingsPageExtension[];
    headerActions?: Component[];
    defaults?: {
      channelConfig?: MaybeAsync<ChannelConfigDefaults>;
    };
  }

  let { extensions }: { extensions?: WebExtension } = $props();

  let channelConfigDefaults = $state<ChannelConfigDefaults | undefined>(undefined);

  const WS_POLL_THRESHOLD = 60;
  const RECONNECT_DELAYS = [0, 1000, 2000, 4000, 8000];
  const baseUrl = window.location.origin;

  // --- Auth state (persisted in localStorage) ---
  let token = $state(localStorage.getItem('zooid_token') ?? '');
  let claims = $state<TokenClaims | null>(null);
  let authModalOpen = $state(false);

  // Reactive SDK client
  let client = $derived(createClient(token || undefined));

  // Admin check
  let isAdmin = $derived(claims?.scopes?.includes('admin') ?? false);

  // --- Channel state ---
  let channels = $state<ChannelInfo[]>([]);
  let selectedId = $state<string | null>(null);
  let channel = $state<ChannelInfo | null>(null);
  let events = $state<ZooidEvent[]>([]);
  let viewMode = $state<'pretty' | 'raw'>('pretty');
  let status = $state<'connected' | 'polling' | 'reconnecting' | 'error' | 'idle' | 'loading'>('idle');
  let cursor = $state<string | null>(null);
  let pollTimer = $state<ReturnType<typeof setInterval> | null>(null);
  let pollInterval = $state(5);
  let ws = $state<WebSocket | null>(null);
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let serverName = $state('Zooid');
  let authUrl = $state<string | undefined>(undefined);
  let refreshTimer = $state<ReturnType<typeof setInterval> | null>(null);
  let replyTo = $state<string | null>(null);

  // Mobile sidebar
  let sidebarOpen = $state(false);

  // Ref side sheet
  let refSheet = $state<{ channel: string; eventId: string } | null>(null);

  function handleOpenRef(detail: { channel: string; eventId: string }) {
    refSheet = detail;
  }

  // Modals
  let createChannelOpen = $state(false);
  let editChannelOpen = $state(false);

  // Settings page routing (built-in + extension slugs)
  let currentView = $state<string>('channel');

  const seenIds = new Set<string>();

  // Check if user can publish to the selected channel
  let canPublishToChannel = $derived.by(() => {
    if (!claims || !selectedId) return false;
    const scopes = claims.scopes;
    if (scopes.includes('admin')) return true;
    return scopes.some((s) =>
      s === `pub:${selectedId}` || s === 'pub:*' ||
      (s.endsWith('*') && s.startsWith('pub:') && selectedId!.startsWith(s.slice(4, -1)))
    );
  });

  // Show reply button when user can publish and channel supports message replies
  let canReply = $derived.by(() => {
    if (!canPublishToChannel) return false;
    if (!channel) return false;
    const config = channel.config as { strict?: boolean; types?: Record<string, unknown> } | null;
    // Non-strict channels always allow reply
    if (!config?.strict) return true;
    // Strict channels: only if "message" type is configured
    return !!config?.types?.['message'];
  });

  function handleReply(eventId: string) {
    replyTo = eventId;
  }

  // --- Init ---

  // Parse initial route
  const path = window.location.pathname;
  const settingsMatch = path.match(/^\/_settings\/(.+)$/);
  if (settingsMatch) {
    const slug = settingsMatch[1];
    currentView = slug;
    // Set title based on known pages or extension pages
    if (slug === 'keys-and-tokens') document.title = 'Keys & Tokens — Zooid';
    else if (slug === 'server') document.title = 'Server Config — Zooid';
    else {
      const ext = extensions?.settingsPages?.find(p => p.slug === slug);
      if (ext) document.title = `${ext.label} — Zooid`;
    }
  } else {
    const routeMatch = path.match(/^\/([a-z0-9][a-z0-9-]{1,62}[a-z0-9])$/);
    if (routeMatch) selectedId = routeMatch[1];
  }

  async function init() {
    // Check if we just came back from an OIDC callback (token set in localStorage by callback page)
    const storedToken = localStorage.getItem('zooid_token');
    if (storedToken && storedToken !== token) {
      token = storedToken;
    }

    const [meta] = await Promise.all([
      fetchServerMeta(baseUrl),
      refreshChannels(),
      token ? validateToken() : Promise.resolve(),
    ]);
    serverName = meta.server_name;
    pollInterval = meta.poll_interval;
    authUrl = meta.auth_url;

    // Resolve channel config defaults (static or async)
    const cfgDefault = extensions?.defaults?.channelConfig;
    if (typeof cfgDefault === 'function') {
      cfgDefault().then((d) => { channelConfigDefaults = d; }).catch(() => {});
    } else if (cfgDefault) {
      channelConfigDefaults = cfgDefault;
    }

    // Start token refresh loop if we have a token with expiry
    if (claims?.exp) {
      startRefreshLoop();
    }

    if (selectedId) {
      selectChannel(selectedId);
    } else if (channels.length > 0) {
      selectChannel(channels[0].id);
    }
  }

  async function refreshChannels() {
    try {
      channels = await client.listChannels();
    } catch {
      channels = [];
    }
  }

  async function validateToken() {
    if (!token) { claims = null; return; }
    try {
      claims = await client.getTokenClaims();
    } catch {
      // Invalid token — clear it
      claims = null;
      token = '';
      localStorage.removeItem('zooid_token');
    }
  }

  // --- Channel selection ---

  function selectChannel(id: string) {
    if (selectedId === id && channel) return;
    currentView = 'channel';
    selectedId = id;
    sidebarOpen = false;

    // Update URL
    window.history.pushState({}, '', `/${id}`);
    document.title = `${id} — Zooid`;

    loadChannel();
  }

  function navigateSettings(page: string, title: string) {
    currentView = page as typeof currentView;
    selectedId = null;
    channel = null;
    cleanup();
    status = 'idle';
    sidebarOpen = false;
    window.history.pushState({}, '', `/_settings/${page}`);
    document.title = `${title} — Zooid`;
  }

  function cleanup() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
    seenIds.clear();
    events = [];
    cursor = null;
    replyTo = null;
  }

  async function loadChannel() {
    if (!selectedId) return;

    cleanup();
    status = 'loading';

    try {
      const list = await client.listChannels();
      const ch = list.find((c) => c.id === selectedId) ?? null;
      if (!ch) {
        channel = null;
        status = 'idle';
        return;
      }
      channel = ch;
    } catch {
      channel = null;
      status = 'idle';
      return;
    }
    document.title = `${channel!.name} — Zooid`;

    // Update RSS link
    updateRssLink(selectedId, token || undefined);

    await fetchEvents();

    const meta = await fetchServerMeta(baseUrl);
    const supportsWs = meta.delivery.includes('websocket');

    if (supportsWs && meta.poll_interval <= WS_POLL_THRESHOLD) {
      connectWebSocket();
    } else {
      pollInterval = meta.poll_interval;
      startPolling();
    }
  }

  // --- Events ---

  async function fetchEvents() {
    if (!selectedId) return;
    try {
      const result = await client.poll(selectedId, {
        cursor: cursor ?? undefined,
        limit: 50,
      });

      if (result.events.length > 0) {
        const newest = result.events.slice().reverse();
        const fresh = newest.filter((e) => !seenIds.has(e.id));
        for (const e of fresh) seenIds.add(e.id);

        if (cursor && fresh.length > 0) {
          events = [...fresh, ...events];
        } else if (!cursor) {
          events = fresh;
        }
        cursor = result.events[result.events.length - 1]?.id ?? cursor;
      }
    } catch {
      status = 'error';
    }
  }

  // --- Polling ---

  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    status = 'polling';
    pollTimer = setInterval(async () => {
      if (selectedId) {
        try {
          const list = await client.listChannels();
          const ch = list.find((c) => c.id === selectedId);
          if (ch) channel = ch;
        } catch { /* keep going */ }
      }
      await fetchEvents();
      status = 'polling';
    }, pollInterval * 1000);
  }

  // --- WebSocket ---

  function connectWebSocket() {
    if (!selectedId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = new URL(`${protocol}//${window.location.host}/api/v1/channels/${selectedId}/ws`);
    if (token) wsUrl.searchParams.set('token', token);

    const socket = new WebSocket(wsUrl.toString());

    socket.addEventListener('open', () => {
      status = 'connected';
      reconnectAttempt = 0;
      fetchEvents();
    });

    socket.addEventListener('message', (e) => {
      try {
        const event: ZooidEvent = JSON.parse(e.data);
        if (seenIds.has(event.id)) return;
        seenIds.add(event.id);
        events = [event, ...events];
        cursor = event.id;
      } catch {}
    });

    socket.addEventListener('close', () => {
      ws = null;
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {});

    ws = socket;
  }

  function scheduleReconnect() {
    if (!selectedId) return;
    if (reconnectAttempt >= RECONNECT_DELAYS.length) {
      startPolling();
      return;
    }
    status = 'reconnecting';
    const delay = RECONNECT_DELAYS[reconnectAttempt];
    reconnectAttempt++;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, delay);
  }

  // --- RSS ---

  function updateRssLink(chId: string, tok?: string) {
    let link = document.querySelector('link[rel="alternate"][type="application/rss+xml"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'alternate';
      link.type = 'application/rss+xml';
      document.head.appendChild(link);
    }
    link.href = tok
      ? `${baseUrl}/api/v1/channels/${chId}/rss?token=${tok}`
      : `${baseUrl}/api/v1/channels/${chId}/rss`;
    link.title = `${chId} RSS Feed`;
  }

  // --- Auth ---

  function handleAuthClick() {
    // Already signed in — open modal to show token / sign out
    if (claims) {
      authModalOpen = true;
      return;
    }
    // OIDC available — redirect directly, skip modal
    if (authUrl) {
      window.location.href = authUrl;
      return;
    }
    // No OIDC — open modal for paste-token flow
    authModalOpen = true;
  }

  async function handleAuthSave(newToken: string): Promise<boolean> {
    token = newToken;
    localStorage.setItem('zooid_token', newToken);
    await validateToken();
    if (!claims) {
      return false;
    }
    authModalOpen = false;
    if (claims.exp) startRefreshLoop();
    await refreshChannels();
    if (selectedId) loadChannel();
    return true;
  }

  async function handleAuthLogout() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
    await authLogout(baseUrl);
    token = '';
    claims = null;
    localStorage.removeItem('zooid_token');
    authModalOpen = false;
    refreshChannels();
    if (selectedId) loadChannel();
  }

  /**
   * Refresh loop: checks token expiry and refreshes via the BFF
   * endpoint ~2 minutes before it expires.
   */
  function startRefreshLoop() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
      if (!claims?.exp) return;
      const now = Math.floor(Date.now() / 1000);
      const remaining = claims.exp - now;

      // Refresh when less than 2 minutes remain
      if (remaining < 120) {
        const result = await refreshAuth(baseUrl);
        if (result?.token) {
          token = result.token;
          localStorage.setItem('zooid_token', token);
          await validateToken();
        } else {
          // Refresh failed — sign out
          handleAuthLogout();
        }
      }
    }, 30_000); // Check every 30 seconds
  }

  // --- Publish ---

  async function handlePublish(payload: { type?: string; reply_to?: string; data: unknown }) {
    if (!selectedId || !token) return;
    try {
      await client.publish(selectedId, payload);
      await fetchEvents();
    } catch {
      // publish failed
    }
  }

  // --- Admin ---

  function handleServerConfigSaved() {
    // Refresh server name from discovery
    fetchServerMeta(baseUrl).then((meta) => {
      serverName = meta.server_name;
    });
  }

  function handleChannelCreated(id: string) {
    refreshChannels().then(() => {
      selectChannel(id);
    });
  }

  function handleChannelEdited() {
    refreshChannels();
    if (selectedId) loadChannel();
  }

  function handleChannelDeleted() {
    selectedId = null;
    channel = null;
    cleanup();
    window.history.pushState({}, '', '/');
    refreshChannels();
  }

  // --- Browser navigation ---

  window.addEventListener('popstate', () => {
    const p = window.location.pathname;
    const sm = p.match(/^\/_settings\/(.+)$/);
    if (sm) {
      currentView = sm[1];
      selectedId = null;
      channel = null;
      cleanup();
      if (sm[1] === 'keys-and-tokens') document.title = 'Keys & Tokens — Zooid';
      else if (sm[1] === 'server') document.title = 'Server Config — Zooid';
      else {
        const ext = extensions?.settingsPages?.find(pg => pg.slug === sm[1]);
        if (ext) document.title = `${ext.label} — Zooid`;
      }
    } else {
      currentView = 'channel';
      const m = p.match(/^\/([a-z0-9][a-z0-9-]{1,62}[a-z0-9])$/);
      if (m) {
        selectedId = m[1];
        loadChannel();
      } else {
        selectedId = null;
        channel = null;
        cleanup();
      }
    }
  });

  init();
</script>

<div class="flex h-dvh w-full overflow-hidden">
  <!-- Sidebar: always visible on md+, slide-over on mobile -->
  <div class="hidden md:flex w-60 shrink-0">
    <Sidebar
      {channels}
      {selectedId}
      {serverName}
      hasAuth={!!claims}
      {isAdmin}
      {status}
      {pollInterval}
      onSelect={selectChannel}
      onAuthClick={handleAuthClick}
      onServerConfig={() => navigateSettings('server', 'Server Config')}
      onKeysAndTokens={() => navigateSettings('keys-and-tokens', 'Keys & Tokens')}
      onCreateChannel={() => createChannelOpen = true}
      extensionSettingsPages={extensions?.settingsPages?.map(p => ({ slug: p.slug, label: p.label, icon: p.icon })) ?? []}
      onExtensionSettings={(slug) => { const ext = extensions?.settingsPages?.find(p => p.slug === slug); if (ext) navigateSettings(slug, ext.label); }}
    />
  </div>

  <!-- Mobile sidebar overlay -->
  {#if sidebarOpen}
    <button type="button" class="fixed inset-0 bg-background/60 z-40 md:hidden" onclick={() => sidebarOpen = false} aria-label="Close sidebar"></button>
    <div class="fixed inset-y-0 left-0 w-60 z-50 md:hidden">
      <Sidebar
        {channels}
        {selectedId}
        {serverName}
        hasAuth={!!claims}
        {isAdmin}
        {status}
        {pollInterval}
        onSelect={selectChannel}
        onAuthClick={() => { sidebarOpen = false; handleAuthClick(); }}
        onClose={() => sidebarOpen = false}
        onServerConfig={() => navigateSettings('server', 'Server Config')}
        onKeysAndTokens={() => navigateSettings('keys-and-tokens', 'Keys & Tokens')}
        onCreateChannel={() => { sidebarOpen = false; createChannelOpen = true; }}
        extensionSettingsPages={extensions?.settingsPages?.map(p => ({ slug: p.slug, label: p.label, icon: p.icon })) ?? []}
        onExtensionSettings={(slug) => { const ext = extensions?.settingsPages?.find(p => p.slug === slug); if (ext) navigateSettings(slug, ext.label); }}
      />
    </div>
  {/if}

  <!-- Main content -->
  {#if currentView === 'keys-and-tokens'}
    <KeysAndTokensPage {client} onMenuClick={() => sidebarOpen = true} />
  {:else if currentView === 'server'}
    <ServerConfigPage {client} onMenuClick={() => sidebarOpen = true} onSaved={handleServerConfigSaved} />
  {:else if extensions?.settingsPages?.some(p => p.slug === currentView)}
    {@const extPage = extensions.settingsPages.find(p => p.slug === currentView)!}
    <extPage.component {client} onMenuClick={() => sidebarOpen = true} />
  {:else}
  <div class="flex-1 flex flex-col min-w-0">
    {#if channel}
      <ChannelHeader {channel} bind:viewMode {isAdmin} onMenuClick={() => sidebarOpen = true} onEditChannel={() => editChannelOpen = true} />
      <EventFeed {events} {viewMode} {canReply} onReply={handleReply} onOpenRef={handleOpenRef} />
      {#if canPublishToChannel}
        <MessageBar {channel} bind:replyTo onPublish={handlePublish} />
      {:else if claims}
        <div class="border-t border-border mx-4 mb-3 mt-1 mb-[calc(0.75rem+env(safe-area-inset-bottom))] px-3 py-2 rounded-lg border bg-secondary/20 text-xs text-muted-foreground/50 text-center">
          You don't have publish access to this channel
        </div>
      {:else}
        <div class="border-t border-border mx-4 mb-3 mt-1 mb-[calc(0.75rem+env(safe-area-inset-bottom))] px-3 py-2 rounded-lg border bg-secondary/20 text-xs text-muted-foreground/50 text-center">
          <button onclick={handleAuthClick} class="hover:text-muted-foreground transition-colors">Sign in to chat</button>
        </div>
      {/if}
    {:else if selectedId}
      <!-- Channel loading or not found -->
      <div class="flex-1 flex flex-col">
        <div class="flex items-center gap-3 px-4 h-12 border-b border-border">
          <button
            onclick={() => sidebarOpen = true}
            class="p-1 rounded hover:bg-secondary transition-colors md:hidden"
            aria-label="Open channels"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
          <span class="text-sm text-muted-foreground">
            {status === 'loading' ? 'Loading...' : 'Channel not found'}
          </span>
        </div>
      </div>
    {:else}
      <!-- No channel selected -->
      <div class="flex-1 flex flex-col items-center justify-center text-muted-foreground">
        <button
          onclick={() => sidebarOpen = true}
          class="p-2 rounded hover:bg-secondary transition-colors md:hidden mb-4"
          aria-label="Open channels"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
        <p class="text-sm">Select a channel</p>
        {#if isAdmin}
          <button
            class="text-xs text-primary hover:text-primary/80 mt-1 transition-colors"
            onclick={() => createChannelOpen = true}
          >Create a channel</button>
        {:else}
          <p class="text-xs text-muted-foreground/60 mt-1">or create one with <code class="text-foreground/80">npx zooid channel create</code></p>
        {/if}
      </div>
    {/if}
  </div>
  {/if}
</div>

<AuthModal
  open={authModalOpen}
  currentToken={claims ? token : null}
  {claims}
  onSave={handleAuthSave}
  onLogout={handleAuthLogout}
  onClose={() => authModalOpen = false}
/>

<CreateChannelModal
  open={createChannelOpen}
  {client}
  defaultConfig={channelConfigDefaults}
  onClose={() => createChannelOpen = false}
  onCreated={handleChannelCreated}
/>

<EditChannelModal
  open={editChannelOpen}
  {channel}
  {client}
  defaultConfig={channelConfigDefaults}
  onClose={() => editChannelOpen = false}
  onSaved={handleChannelEdited}
  onDeleted={handleChannelDeleted}
/>

{#if refSheet}
  <RefSideSheet
    channel={refSheet.channel}
    eventId={refSheet.eventId}
    {client}
    onClose={() => refSheet = null}
  />
{/if}
