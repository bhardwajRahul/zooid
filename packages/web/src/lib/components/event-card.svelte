<script lang="ts">
  import type { ZooidEvent } from '../api';
  import { parsePretty, renderMarkdown, type PrettyNode } from '../pretty-json';
  import { formatRelative } from '../time';
  import Avatar from './avatar.svelte';

  let { event, viewMode = 'pretty' }: { event: ZooidEvent; viewMode?: 'pretty' | 'raw' } = $props();

  let rawData = $derived(formatRaw(event.data));
  let prettyEntries = $derived(parsePretty(event.data));
  let relativeTime = $derived(formatRelative(event.created_at));
  let publisherLabel = $derived(formatPublisher(event));
  let inReplyTo = $derived(extractReplyTo(event.data));

  function formatRaw(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  function extractReplyTo(raw: string): string | null {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed.in_reply_to === 'string') return parsed.in_reply_to;
    } catch {}
    return null;
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

<div class="group py-2 px-2 hover:bg-secondary/30 rounded transition-colors">
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
    <span class="text-[10px] text-muted-foreground/40 ml-auto shrink-0">{relativeTime}</span>
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
