<script lang="ts">
  import { Badge } from '@ui/components/badge/index';
  import { Card, CardContent } from '@ui/components/card/index';
  import { marked } from 'marked';
  import type { ZooidEvent } from '../api';

  let { event, viewMode = 'pretty' }: { event: ZooidEvent; viewMode?: 'pretty' | 'raw' } = $props();

  let rawData = $derived(formatRaw(event.data));
  let prettyEntries = $derived(parsePretty(event.data));
  let relativeTime = $derived(formatRelative(event.created_at));

  marked.setOptions({ breaks: true, gfm: true });

  function formatRaw(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  type PrettyNode =
    | { kind: 'text'; key: string; value: string; markdown: boolean }
    | { kind: 'group'; key: string; children: PrettyNode[] }
    | { kind: 'list'; key: string; items: PrettyNode[][] };

  const MD_HINT = /[*_#\[`~>]|\n[-*] |\n\d+\. /;

  function looksLikeMarkdown(s: string): boolean {
    return MD_HINT.test(s);
  }

  function renderMarkdown(s: string): string {
    return marked.parse(s, { async: false }) as string;
  }

  function parsePretty(raw: string): PrettyNode[] | null {
    try {
      const obj = JSON.parse(raw);
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
      return objectToNodes(obj);
    } catch {
      return null;
    }
  }

  function objectToNodes(obj: Record<string, unknown>): PrettyNode[] {
    return Object.entries(obj).map(([key, value]) => {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return {
          kind: 'group' as const,
          key,
          children: objectToNodes(value as Record<string, unknown>),
        };
      }
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        return {
          kind: 'list' as const,
          key,
          items: value.map((item) =>
            typeof item === 'object' && item !== null && !Array.isArray(item)
              ? objectToNodes(item as Record<string, unknown>)
              : [{ kind: 'text' as const, key: '', value: String(item), markdown: false }],
          ),
        };
      }
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      return { kind: 'text' as const, key, value: str, markdown: looksLikeMarkdown(str) };
    });
  }

  function formatRelative(iso: string): string {
    const hasOffset = /Z|[+-]\d{2}:?\d{2}$/.test(iso);
    const ts = hasOffset ? iso : iso + 'Z';
    const diff = Date.now() - new Date(ts).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
</script>

{#snippet prettyNode(node: PrettyNode, depth: number)}
  {#if node.kind === 'text'}
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
        {#if event.publisher_id}
          <span class="text-xs text-muted-foreground">{event.publisher_id}</span>
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
