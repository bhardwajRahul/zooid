<script lang="ts">
  import type { ZooidEvent } from '../api';
  import EventCard from './event-card.svelte';

  let {
    channel,
    eventId,
    client,
    onClose,
  }: {
    channel: string;
    eventId: string;
    client: { poll: (channelId: string, options?: { cursor?: string; limit?: number }) => Promise<{ events: ZooidEvent[] }> };
    onClose?: () => void;
  } = $props();

  let event = $state<ZooidEvent | null>(null);
  let thread = $state<ZooidEvent[] | null>(null);
  let loading = $state(true);
  let threadExpanded = $state(false);

  async function fetchEvent() {
    loading = true;
    try {
      const res = await fetch(`/api/v1/channels/${channel}/events/${eventId}`);
      if (res.ok) {
        event = await res.json();
      }
    } catch {
      // fetch failed
    }
    loading = false;
  }

  async function expandThread() {
    try {
      const res = await fetch(`/api/v1/channels/${channel}/events/${eventId}/thread`);
      if (res.ok) {
        const body = await res.json();
        thread = body.events ?? [];
      }
    } catch {
      // fetch failed
    }
    threadExpanded = true;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose?.();
  }

  $effect(() => {
    if (channel && eventId) fetchEvent();
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<button
  type="button"
  class="fixed inset-0 bg-background/40 z-40"
  onclick={() => onClose?.()}
  aria-label="Close ref panel"
></button>

<div class="fixed inset-y-0 right-0 w-80 max-w-[85vw] bg-card border-l border-border shadow-lg z-50 p-4 flex flex-col gap-3 animate-slide-in-right overflow-y-auto">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-semibold">#{channel} / {eventId.slice(0, 8)}&hellip;</h3>
    <button class="text-muted-foreground hover:text-foreground transition-colors" onclick={() => onClose?.()} aria-label="Close">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  </div>

  {#if loading}
    <div class="text-sm text-muted-foreground">Loading&hellip;</div>
  {:else if event}
    <EventCard {event} />

    {#if !threadExpanded}
      <button class="text-xs text-primary hover:text-primary/80 transition-colors" onclick={expandThread}>
        Expand thread
      </button>
    {:else if thread && thread.length > 0}
      <div class="flex flex-col gap-1 border-t border-border pt-2">
        {#each thread as threadEvent}
          <EventCard event={threadEvent} />
        {/each}
      </div>
    {:else if thread}
      <div class="text-xs text-muted-foreground">No replies</div>
    {/if}
  {:else}
    <div class="text-sm text-muted-foreground">Event not found</div>
  {/if}
</div>

<style>
  @keyframes slide-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .animate-slide-in-right {
    animation: slide-in-right 0.15s ease-out;
  }
</style>
