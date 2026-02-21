<script lang="ts">
  import { Badge } from '@ui/components/badge/index';
  import { Card, CardContent } from '@ui/components/card/index';
  import type { ZooidEvent } from '../api';

  let { event, viewMode = 'pretty' }: { event: ZooidEvent; viewMode?: 'pretty' | 'raw' } = $props();

  let rawData = $derived(formatRaw(event.data));
  let prettyEntries = $derived(parsePretty(event.data));
  let relativeTime = $derived(formatRelative(event.created_at));

  function formatRaw(raw: string): string {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }

  function parsePretty(raw: string): { key: string; lines: string[] }[] | null {
    try {
      const obj = JSON.parse(raw);
      if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
      return Object.entries(obj).map(([key, value]) => {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        return { key, lines: str.split(/\\n|\n/) };
      });
    } catch {
      return null;
    }
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
        {#each prettyEntries as { key, lines }}
          <div>
            <span class="font-semibold text-foreground/90">{key}</span><span class="text-foreground/50">: </span>{#each lines as line, i}{#if i > 0}<br />{/if}{line}{/each}
          </div>
        {/each}
      </div>
    {:else}
      <pre class="text-xs text-foreground/80 bg-background rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{rawData}</pre>
    {/if}
  </CardContent>
</Card>
