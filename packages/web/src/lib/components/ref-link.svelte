<script lang="ts">
  import { resolveRef } from '../zooid-uri';

  let {
    ref,
    serverUrl = '',
    onOpenRef,
  }: {
    ref: string;
    serverUrl?: string;
    onOpenRef?: (detail: { channel: string; eventId: string }) => void;
  } = $props();

  let resolved = $derived(resolveRef(ref, serverUrl));

  function handleClick() {
    if (resolved.type === 'zooid') {
      onOpenRef?.({ channel: resolved.channel, eventId: resolved.eventId });
    }
  }
</script>

{#if resolved.type === 'zooid'}
  <button class="text-xs font-mono text-primary/70 hover:text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0 rounded cursor-pointer transition-colors" onclick={handleClick}>
    {resolved.label}
  </button>
{:else if resolved.type === 'zooid-external' || resolved.type === 'external'}
  <a href={resolved.href} target="_blank" rel="noopener" class="text-xs font-mono text-primary/70 hover:text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0 rounded transition-colors">
    {resolved.label}
  </a>
{:else}
  <span class="text-xs font-mono text-muted-foreground">{resolved.label}</span>
{/if}
