<script lang="ts">
  import Sidebar from './lib/components/sidebar.svelte';
  import ChannelHeader from './lib/components/channel-header.svelte';
  import EventFeed from './lib/components/event-feed.svelte';
  import MessageBar from './lib/components/message-bar.svelte';
  import AuthModal from './lib/components/auth-modal.svelte';
  import {
    fetchServerMeta,
    getChannel,
    listChannels,
    pollEvents,
    publishEvent,
    getTokenClaims,
    type ChannelInfo,
    type ZooidEvent,
    type TokenClaims,
  } from './lib/api';

  const WS_POLL_THRESHOLD = 60;
  const RECONNECT_DELAYS = [0, 1000, 2000, 4000, 8000];
  const baseUrl = window.location.origin;

  // --- Auth state (persisted in localStorage) ---
  let token = $state(localStorage.getItem('zooid_token') ?? '');
  let claims = $state<TokenClaims | null>(null);
  let authModalOpen = $state(false);

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

  // Mobile sidebar
  let sidebarOpen = $state(false);

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

  // --- Init ---

  // Parse initial route
  const path = window.location.pathname;
  const routeMatch = path.match(/^\/([a-z0-9][a-z0-9-]{1,62}[a-z0-9])$/);
  if (routeMatch) selectedId = routeMatch[1];

  async function init() {
    const [meta] = await Promise.all([
      fetchServerMeta(baseUrl),
      refreshChannels(),
      token ? validateToken() : Promise.resolve(),
    ]);
    serverName = meta.server_name;
    pollInterval = meta.poll_interval;

    if (selectedId) {
      selectChannel(selectedId);
    }
  }

  async function refreshChannels() {
    channels = await listChannels(baseUrl, token || undefined);
  }

  async function validateToken() {
    if (!token) { claims = null; return; }
    claims = await getTokenClaims(baseUrl, token);
    if (!claims) {
      // Invalid token — clear it
      token = '';
      localStorage.removeItem('zooid_token');
    }
  }

  // --- Channel selection ---

  function selectChannel(id: string) {
    if (selectedId === id && channel) return;
    selectedId = id;
    sidebarOpen = false;

    // Update URL
    window.history.pushState({}, '', `/${id}`);
    document.title = `${id} — Zooid`;

    loadChannel();
  }

  function cleanup() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
    seenIds.clear();
    events = [];
    cursor = null;
  }

  async function loadChannel() {
    if (!selectedId) return;

    cleanup();
    status = 'loading';

    const ch = await getChannel(baseUrl, selectedId, token || undefined);
    if (!ch) {
      channel = null;
      status = 'idle';
      return;
    }

    channel = ch;
    document.title = `${ch.name} — Zooid`;

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
      const result = await pollEvents(baseUrl, selectedId, {
        cursor: cursor ?? undefined,
        token: token || undefined,
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
        const ch = await getChannel(baseUrl, selectedId, token || undefined);
        if (ch) channel = ch;
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

  async function handleAuthSave(newToken: string): Promise<boolean> {
    token = newToken;
    localStorage.setItem('zooid_token', newToken);
    await validateToken();
    if (!claims) {
      // Token was invalid — validateToken already cleared it
      return false;
    }
    authModalOpen = false;
    await refreshChannels();
    if (selectedId) loadChannel();
    return true;
  }

  function handleAuthLogout() {
    token = '';
    claims = null;
    localStorage.removeItem('zooid_token');
    authModalOpen = false;
    refreshChannels();
    if (selectedId) loadChannel();
  }

  // --- Publish ---

  async function handlePublish(payload: { type?: string; data: unknown }) {
    if (!selectedId || !token) return;
    const ok = await publishEvent(baseUrl, selectedId, payload, token);
    if (ok) {
      // Event will appear via WS or next poll
      await fetchEvents();
    }
  }

  // --- Browser navigation ---

  window.addEventListener('popstate', () => {
    const m = window.location.pathname.match(/^\/([a-z0-9][a-z0-9-]{1,62}[a-z0-9])$/);
    if (m) {
      selectedId = m[1];
      loadChannel();
    } else {
      selectedId = null;
      channel = null;
      cleanup();
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
      {status}
      {pollInterval}
      onSelect={selectChannel}
      onAuthClick={() => authModalOpen = true}
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
        {status}
        {pollInterval}
        onSelect={selectChannel}
        onAuthClick={() => { sidebarOpen = false; authModalOpen = true; }}
        onClose={() => sidebarOpen = false}
      />
    </div>
  {/if}

  <!-- Main content -->
  <div class="flex-1 flex flex-col min-w-0">
    {#if channel}
      <ChannelHeader {channel} bind:viewMode onMenuClick={() => sidebarOpen = true} />
      <EventFeed {events} {viewMode} />
      {#if canPublishToChannel}
        <MessageBar {channel} onPublish={handlePublish} />
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
        <p class="text-xs text-muted-foreground/60 mt-1">or create one with <code class="text-foreground/80">npx zooid channel create</code></p>
      </div>
    {/if}
  </div>
</div>

<AuthModal
  open={authModalOpen}
  currentToken={claims ? token : null}
  onSave={handleAuthSave}
  onLogout={handleAuthLogout}
  onClose={() => authModalOpen = false}
/>
