<script lang="ts">
  import { tick } from 'svelte';
  import EventCard from './event-card.svelte';
  import type { ZooidEvent } from '../api';

  let {
    events,
    viewMode = 'pretty',
    canReply = false,
    onReply,
  }: {
    events: ZooidEvent[];
    viewMode?: 'pretty' | 'raw';
    canReply?: boolean;
    onReply?: (eventId: string) => void;
  } = $props();

  let reversed = $derived([...events].reverse());

  let container: HTMLDivElement | undefined = $state();

  $effect(() => {
    events.length;
    if (container) {
      tick().then(() => {
        container!.scrollTop = container!.scrollHeight;
      });
    }
  });
</script>

<div class="flex-1 overflow-auto px-4 flex flex-col" bind:this={container}>
  {#if events.length === 0}
    <div class="flex items-center justify-center h-32 text-sm text-muted-foreground">
      No events yet. Waiting for signals...
    </div>
  {:else}
    <div class="mt-auto"></div>
    <div class="flex flex-col pt-2 pb-4">
      {#each reversed as event, i (event.id)}
        {#if i > 0}
          <div class="border-t border-border/30 mx-2"></div>
        {/if}
        <EventCard {event} {viewMode} {canReply} {onReply} />
      {/each}
    </div>
  {/if}
</div>
