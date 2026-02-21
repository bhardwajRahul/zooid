<script lang="ts">
  import { ScrollArea } from '@ui/components/scroll-area/index';
  import EventCard from './event-card.svelte';
  import type { ZooidEvent } from '../api';

  let { events }: { events: ZooidEvent[] } = $props();

  let container: HTMLDivElement | undefined = $state();
  let viewMode: 'pretty' | 'raw' = $state('pretty');

  $effect(() => {
    if (events.length > 0 && container) {
      container.scrollTop = 0;
    }
  });
</script>

{#if events.length > 0}
  <div class="flex justify-end px-4 pb-1">
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
{/if}

<ScrollArea class="flex-1 px-4" bind:this={container}>
  {#if events.length === 0}
    <div class="flex items-center justify-center h-32 text-sm text-muted-foreground">
      No events yet. Waiting for signals...
    </div>
  {:else}
    <div class="flex flex-col gap-2 pb-4">
      {#each events as event (event.id)}
        <EventCard {event} {viewMode} />
      {/each}
    </div>
  {/if}
</ScrollArea>
