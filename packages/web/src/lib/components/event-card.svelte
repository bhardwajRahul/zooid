<script lang="ts">
  import { Badge } from '@ui/components/badge/index';
  import { Card, CardContent } from '@ui/components/card/index';
  import type { ZooidEvent } from '../api';
  import { parsePretty, renderMarkdown, type PrettyNode } from '../pretty-json';
  import { formatRelative } from '../time';

  let { event, viewMode = 'pretty' }: { event: ZooidEvent; viewMode?: 'pretty' | 'raw' } = $props();

  let rawData = $derived(formatRaw(event.data));
  let prettyEntries = $derived(parsePretty(event.data));
  let relativeTime = $derived(formatRelative(event.created_at));
  let publisherLabel = $derived(formatPublisher(event));

  function formatRaw(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  function formatPublisher(e: ZooidEvent): string | null {
    const id = e.publisher_id;
    const name = e.publisher_name;
    if (!name && !id) return null;
    // External issuer: publisher_id is "issuer:sub"
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
    {#each node.items as fields, idx}
      <div class="border-l-2 border-border/40 ml-1" style="padding-left: {(depth + 1) * 0.75}rem">
        <span class="text-[10px] text-muted-foreground">{idx + 1}.</span>
        {#each fields as child}
          {@render prettyNode(child, depth + 2)}
        {/each}
      </div>
    {/each}
  {/if}
{/snippet}

<Card class="border-border/50">
  <CardContent class="p-3">
    <div class="flex items-center justify-between gap-2 mb-2">
      <div class="flex items-center gap-2">
        {#if event.type}
          <Badge variant="secondary" class="text-[10px] px-1.5 py-0">{event.type}</Badge>
        {/if}
        {#if publisherLabel}
          <span class="text-xs text-muted-foreground">{publisherLabel}</span>
        {/if}
      </div>
      <span class="text-[10px] text-muted-foreground shrink-0">{relativeTime}</span>
    </div>
    {#if viewMode === 'pretty' && prettyEntries}
      <div class="text-sm text-foreground/80 bg-background rounded p-2 flex flex-col gap-1.5">
        {#each prettyEntries as node}
          {@render prettyNode(node, 0)}
        {/each}
      </div>
    {:else}
      <pre class="text-xs text-foreground/80 bg-background rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{rawData}</pre>
    {/if}
  </CardContent>
</Card>
