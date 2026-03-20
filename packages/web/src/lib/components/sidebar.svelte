<script lang="ts">
  import type { ChannelInfo } from '../api';
  import AdminDropdown from './admin-dropdown.svelte';

  import type { Component } from 'svelte';

  interface SettingsPageExtension {
    slug: string;
    label: string;
    icon?: Component;
  }

  let {
    channels,
    selectedId,
    serverName,
    hasAuth,
    isAdmin,
    status,
    pollInterval,
    onSelect,
    onAuthClick,
    onClose,
    onServerConfig,
    onKeysAndTokens,
    onCreateChannel,
    extensionSettingsPages = [],
    onExtensionSettings,
  }: {
    channels: ChannelInfo[];
    selectedId: string | null;
    serverName: string;
    hasAuth: boolean;
    isAdmin: boolean;
    status: 'connected' | 'polling' | 'reconnecting' | 'error' | 'idle' | 'loading';
    pollInterval: number;
    onSelect: (id: string) => void;
    onAuthClick: () => void;
    onClose?: () => void;
    onServerConfig: () => void;
    onKeysAndTokens: () => void;
    onCreateChannel: () => void;
    extensionSettingsPages?: SettingsPageExtension[];
    onExtensionSettings?: (slug: string) => void;
  } = $props();

  const statusColor: Record<string, string> = {
    connected: 'bg-primary',
    polling: 'bg-primary',
    reconnecting: 'bg-yellow-500',
    error: 'bg-destructive',
    idle: 'bg-muted-foreground',
    loading: 'bg-muted-foreground',
  };

  const statusLabel: Record<string, string> = {
    connected: 'Connected',
    polling: 'Connected',
    reconnecting: 'Reconnecting...',
    error: 'Error',
    idle: 'Idle',
    loading: 'Loading...',
  };
</script>

<div class="flex flex-col h-full w-full bg-[oklch(0.13_0_0)] border-r border-border">
  <!-- Server header -->
  <div class="flex items-center justify-between px-3 h-12 border-b border-border shrink-0">
    {#if isAdmin}
      <AdminDropdown {serverName} {onServerConfig} {onKeysAndTokens} {extensionSettingsPages} {onExtensionSettings} />
    {:else}
      <span class="font-semibold text-sm truncate">{serverName}</span>
    {/if}
    {#if onClose}
      <button
        onclick={onClose}
        class="p-1.5 rounded hover:bg-secondary transition-colors md:hidden"
        aria-label="Close sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    {/if}
  </div>

  <!-- Channel list -->
  <div class="flex-1 overflow-y-auto py-2">
    <div class="px-3 mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Channels</div>
    {#each channels as ch (ch.id)}
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm transition-colors
          {selectedId === ch.id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}"
        onclick={() => onSelect(ch.id)}
      >
        <span class="text-muted-foreground/60 shrink-0">#</span>
        <span class="truncate flex-1">{ch.name}</span>
        {#if !ch.is_public}
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/40 shrink-0"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        {/if}
      </button>
    {/each}

    {#if channels.length === 0 && !isAdmin}
      <div class="px-3 py-4 text-xs text-muted-foreground/60 text-center">
        No channels yet
      </div>
    {/if}

    {#if isAdmin}
      <button
        class="w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary/50 transition-colors"
        onclick={onCreateChannel}
      >
        <span class="shrink-0">+</span>
        <span>Create channel</span>
      </button>
    {/if}
  </div>

  <!-- Profile -->
  <button
    onclick={onAuthClick}
    class="border-t border-border px-3 h-12 flex items-center gap-2 w-full hover:bg-secondary/50 transition-colors shrink-0"
    title={hasAuth ? 'Authenticated' : 'Sign in'}
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={hasAuth ? 'text-primary' : 'text-muted-foreground'}>
      <circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>
    </svg>
    <span class="text-xs {hasAuth ? 'text-foreground' : 'text-muted-foreground'}">{hasAuth ? 'Signed in' : 'Sign in'}</span>
  </button>

  <!-- Status + powered by -->
  <div class="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground/50">
    <div class="flex items-center gap-1.5">
      <span class={`inline-block w-1.5 h-1.5 rounded-full ${statusColor[status]}`}></span>
      <span>{statusLabel[status]}</span>
      {#if status === 'connected'}
        <span class="text-muted-foreground/30">WS</span>
      {:else if status === 'polling'}
        <span class="text-muted-foreground/30">{pollInterval}s</span>
      {/if}
    </div>
    <a href="https://zooid.dev" class="underline hover:text-muted-foreground/70">Zooid</a>
  </div>
</div>
