<script lang="ts">
  import { Badge } from '@ui/components/badge/index';
  import { Separator } from '@ui/components/separator/index';
  import type { ChannelInfo } from '../api';
  import { formatRelative } from '../time';

  let {
    channel,
    viewMode = $bindable('pretty'),
    onMenuClick,
  }: {
    channel: ChannelInfo;
    viewMode?: 'pretty' | 'raw';
    onMenuClick?: () => void;
  } = $props();
</script>

<div class="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
  {#if onMenuClick}
    <button
      onclick={onMenuClick}
      class="p-1 rounded hover:bg-secondary transition-colors md:hidden shrink-0"
      aria-label="Open channels"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
    </button>
  {/if}

  <span class="text-muted-foreground/60">#</span>
  <span class="font-semibold text-sm">{channel.name}</span>

  {#if !channel.is_public}
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/40"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  {/if}

  {#if channel.description}
    <Separator orientation="vertical" class="h-4" />
    <span class="text-xs text-muted-foreground truncate hidden sm:block">{channel.description}</span>
  {/if}

  <div class="ml-auto flex items-center gap-2">
    <span class="text-[10px] text-muted-foreground hidden sm:block">
      {channel.event_count} events
    </span>
    <div class="flex items-center bg-muted/50 rounded-md p-0.5 text-[11px]">
      <button
        class="px-2 py-0.5 rounded transition-colors {viewMode === 'pretty' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => viewMode = 'pretty'}
      >
        Pretty
      </button>
      <button
        class="px-2 py-0.5 rounded transition-colors font-mono {viewMode === 'raw' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => viewMode = 'raw'}
      >
        {'{ }'}
      </button>
    </div>
  </div>
</div>
