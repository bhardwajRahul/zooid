<script lang="ts">
  import type { ZooidEvent } from '../api';
  import { parsePretty, renderMarkdown, type PrettyNode } from '../pretty-json';
  import { formatRelative, formatFull } from '../time';
  import Avatar from './avatar.svelte';

  let {
    event,
    viewMode = 'pretty',
    canReply = false,
    onReply,
  }: {
    event: ZooidEvent;
    viewMode?: 'pretty' | 'raw';
    canReply?: boolean;
    onReply?: (eventId: string) => void;
  } = $props();

  let rawData = $derived(formatRaw(event.data));
  let prettyEntries = $derived(parsePretty(event.data));
  let relativeTime = $derived(formatRelative(event.created_at));
  let fullTime = $derived(formatFull(event.created_at));
  let publisherLabel = $derived(formatPublisher(event));
  let inReplyTo = $derived(event.reply_to ?? null);

  let detailOpen = $state(false);

  function formatRaw(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  function scrollToEvent(id: string) {
    const el = document.getElementById(`event-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-primary/10');
      setTimeout(() => el.classList.remove('bg-primary/10'), 1500);
    }
  }

  function formatPublisher(e: ZooidEvent): string | null {
    const id = e.publisher_id;
    const name = e.publisher_name;
    if (!name && !id) return null;
    const colonIdx = id?.indexOf(':') ?? -1;
    const issuer = colonIdx > 0 ? id!.slice(0, colonIdx) : null;
    const isExternal = issuer && issuer !== 'local';
    if (name && isExternal) return `${name} (@${issuer})`;
    if (name) return name;
    return id;
  }

  function toggleDetail() {
    detailOpen = !detailOpen;
  }

  function closeDetail() {
    detailOpen = false;
  }
</script>

{#snippet prettyNode(node: PrettyNode, depth: number)}
  {#if node.kind === 'text' && node.multiline}
    <div style={depth > 0 ? `padding-left: ${depth * 0.75}rem` : ''}>
      <span class="font-semibold text-foreground/90">{node.key}</span><span class="text-foreground/50">:</span>
    </div>
    <div class="break-words overflow-wrap-anywhere text-foreground/70" style="padding-left: {(depth + 1) * 0.75}rem">
      {#if node.markdown}<span class="prose-inline">{@html renderMarkdown(node.value)}</span>{:else}{#each node.value.split('\n') as line, i}{#if i > 0}<br />{/if}{line}{/each}{/if}
    </div>
  {:else if node.kind === 'text'}
    <div class="break-words overflow-wrap-anywhere" style={depth > 0 ? `padding-left: ${depth * 0.75}rem` : ''}>
      {#if node.key}<span class="font-semibold text-foreground/90">{node.key}</span><span class="text-foreground/50">: </span>{/if}{#if node.markdown}<span class="prose-inline">{@html renderMarkdown(node.value)}</span>{:else}{node.value}{/if}
    </div>
  {:else if node.kind === 'group'}
    <div style={depth > 0 ? `padding-left: ${depth * 0.75}rem` : ''}>
      <span class="font-semibold text-foreground/90">{node.key}</span><span class="text-foreground/50">:</span>
    </div>
    {#each node.children as child}
      {@render prettyNode(child, depth + 1)}
    {/each}
  {:else}
    <div style={depth > 0 ? `padding-left: ${depth * 0.75}rem` : ''}>
      <span class="font-semibold text-foreground/90">{node.key}</span><span class="text-foreground/50">:</span>
    </div>
    <ol class="list-decimal list-inside" style="padding-left: {(depth + 1) * 0.75}rem">
      {#each node.items as fields}
        <li class="text-foreground/80">
          {#if fields.length === 1 && fields[0].kind === 'text' && !fields[0].key}
            {fields[0].value}
          {:else}
            {#each fields as child}
              {@render prettyNode(child, depth + 2)}
            {/each}
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
{/snippet}

<div id="event-{event.id}" class="group py-2 px-2 hover:bg-secondary/30 rounded transition-colors">
  <!-- Header: publisher + type + time -->
  <div class="flex items-center gap-2 mb-0.5">
    <Avatar {event} size={20} />
    <span class="font-semibold text-sm text-foreground">
      {publisherLabel ?? 'anonymous'}
    </span>
    {#if event.type}
      <span class="text-[10px] font-mono text-muted-foreground/60 bg-secondary/60 px-1.5 py-0 rounded">{event.type}</span>
    {/if}
    {#if inReplyTo}
      <button
        class="text-[10px] font-mono text-primary/60 hover:text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0 rounded cursor-pointer transition-colors"
        onclick={() => scrollToEvent(inReplyTo!)}
        title="Scroll to parent event"
      >&#8593; reply</button>
    {/if}
    <div class="ml-auto shrink-0 flex items-center gap-1">
      {#if canReply}
        <button
          class="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-foreground transition-colors px-1"
          onclick={() => onReply?.(event.id)}
          title="Reply"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
        </button>
      {/if}
      <button
        class="text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors relative"
        onclick={toggleDetail}
      >
        {relativeTime}
      </button>
    </div>
  </div>

  <!-- Body -->
  {#if viewMode === 'pretty' && prettyEntries}
    <div class="text-sm text-foreground/80 flex flex-col gap-0.5 pl-0">
      {#each prettyEntries as node}
        {@render prettyNode(node, 0)}
      {/each}
    </div>
  {:else}
    <pre class="text-xs text-foreground/60 overflow-x-auto whitespace-pre-wrap break-all font-mono">{rawData}</pre>
  {/if}
</div>

<!-- Detail slide-over panel (from right) -->
{#if detailOpen}
  <button
    type="button"
    class="fixed inset-0 bg-background/40 z-40"
    onclick={closeDetail}
    aria-label="Close detail panel"
  ></button>
  <div class="fixed inset-y-0 right-0 w-72 max-w-[80vw] bg-card border-l border-border shadow-lg z-50 p-4 flex flex-col gap-3 animate-slide-in-right">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold">Event detail</h3>
      <button class="text-muted-foreground hover:text-foreground transition-colors" onclick={closeDetail} aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="flex flex-col gap-2 text-xs">
      <div>
        <div class="text-muted-foreground mb-0.5">Created</div>
        <div class="text-foreground font-mono">{fullTime}</div>
      </div>
      <div>
        <div class="text-muted-foreground mb-0.5">Event ID</div>
        <div class="text-foreground font-mono break-all select-all">{event.id}</div>
      </div>
      {#if event.type}
        <div>
          <div class="text-muted-foreground mb-0.5">Type</div>
          <div class="text-foreground font-mono">{event.type}</div>
        </div>
      {/if}
      {#if publisherLabel}
        <div>
          <div class="text-muted-foreground mb-0.5">Publisher</div>
          <div class="text-foreground">{publisherLabel}</div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes slide-in-right {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .animate-slide-in-right {
    animation: slide-in-right 0.15s ease-out;
  }
</style>
