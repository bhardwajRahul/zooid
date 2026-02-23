<script lang="ts">
  import { Badge } from '@ui/components/badge/index';
  import { Separator } from '@ui/components/separator/index';
  import type { ChannelInfo } from '../api';
  import { formatRelative } from '../time';

  let { channel, viewMode = $bindable('pretty') }: { channel: ChannelInfo; viewMode?: 'pretty' | 'raw' } = $props();
</script>

<div class="flex flex-col gap-2 px-4 py-4">
  <div class="flex items-center gap-3">
    <a href="/" class="text-muted-foreground hover:text-foreground transition-colors -ml-0.5 shrink-0" aria-label="Back to server">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </a>
    <h1 class="text-lg font-semibold tracking-tight">{channel.name}</h1>
    {#if channel.is_public}
      <Badge variant="secondary">public</Badge>
    {:else}
      <Badge variant="outline">private</Badge>
    {/if}
  </div>

  {#if channel.description}
    <p class="text-sm text-muted-foreground">{channel.description}</p>
  {/if}

  <div class="flex items-center gap-4 text-xs text-muted-foreground">
    <span>{channel.event_count} events</span>
    {#if channel.publishers.length > 0}
      <span>{channel.publishers.length} publisher{channel.publishers.length === 1 ? '' : 's'}</span>
    {/if}
    {#if channel.last_event_at}
      <span>latest {formatRelative(channel.last_event_at)}</span>
    {/if}
    <div class="ml-auto flex items-center bg-muted/50 rounded-md p-0.5 text-[11px]">
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
  <Separator />
</div>
