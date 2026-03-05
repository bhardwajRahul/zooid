<script lang="ts">
  let {
    status,
    pollInterval,
  }: {
    status: 'connected' | 'polling' | 'reconnecting' | 'error' | 'idle' | 'loading';
    pollInterval: number;
  } = $props();

  const statusText: Record<string, string> = {
    connected: 'Connected',
    polling: 'Connected',
    reconnecting: 'Reconnecting...',
    error: 'Error',
    idle: 'Idle',
    loading: 'Loading...',
  };

  const statusColor: Record<string, string> = {
    connected: 'bg-primary',
    polling: 'bg-primary',
    reconnecting: 'bg-yellow-500',
    error: 'bg-destructive',
    idle: 'bg-muted-foreground',
    loading: 'bg-muted-foreground',
  };
</script>

<div class="flex items-center justify-between px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-xs text-muted-foreground border-t border-border">
  <div class="flex items-center gap-2">
    <span class={`inline-block w-1.5 h-1.5 rounded-full ${statusColor[status]}`}></span>
    <span>{statusText[status]}</span>
    {#if status === 'connected'}
      <span class="text-muted-foreground/60">WebSocket</span>
    {:else if status === 'polling'}
      <span class="text-muted-foreground/60">poll every {pollInterval}s</span>
    {/if}
  </div>
  <span class="text-muted-foreground/40"><a href="https://zooid.dev" class="underline hover:text-muted-foreground">Powered by Zooid</a></span>
</div>
