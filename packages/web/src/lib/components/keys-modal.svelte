<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import type { ZooidClient, TrustedKey } from '@zooid/sdk';
  import { formatRelative } from '../time';

  let {
    open,
    client,
    onClose,
  }: {
    open: boolean;
    client: ZooidClient;
    onClose: () => void;
  } = $props();

  let keys = $state<TrustedKey[]>([]);
  let loading = $state(false);
  let error = $state('');
  let revoking = $state<string | null>(null);

  $effect(() => {
    if (open) {
      error = '';
      loadKeys();
    }
  });

  async function loadKeys() {
    loading = true;
    try {
      keys = await client.listKeys();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load keys';
    } finally {
      loading = false;
    }
  }

  async function handleRevoke(kid: string) {
    if (!confirm(`Revoke key "${kid}"? Tokens signed by this key will stop working.`)) return;
    revoking = kid;
    error = '';
    try {
      await client.revokeKey(kid);
      keys = keys.filter((k) => k.kid !== kid);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to revoke key';
    } finally {
      revoking = null;
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

{#if open}
  <div
    class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Signing keys"
    tabindex="-1"
    onclick={handleBackdrop}
    onkeydown={handleKeydown}
  >
    <div class="bg-card border border-border rounded-lg shadow-lg w-full max-w-md p-6">
      <h2 class="font-semibold text-sm mb-1">Signing Keys</h2>
      <p class="text-xs text-muted-foreground mb-4">
        Trusted keys used to verify JWT tokens.
      </p>

      {#if loading}
        <p class="text-xs text-muted-foreground">Loading...</p>
      {:else if keys.length === 0}
        <p class="text-xs text-muted-foreground/60 text-center py-4">No keys found</p>
      {:else}
        <div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {#each keys as key (key.kid)}
            <div class="bg-secondary rounded-md px-3 py-2 flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="text-xs font-mono font-medium truncate">{key.kid}</div>
                <div class="text-[10px] text-muted-foreground mt-0.5">
                  {key.crv} · {key.issuer ?? 'unknown issuer'} · {formatRelative(key.created_at)}
                </div>
                {#if key.max_scopes}
                  <div class="text-[10px] text-muted-foreground/60 mt-0.5 font-mono truncate">
                    {key.max_scopes.join(', ')}
                  </div>
                {/if}
              </div>
              <Button
                variant="destructive"
                size="sm"
                class="shrink-0 text-[10px] h-6 px-2"
                disabled={revoking === key.kid}
                onclick={() => handleRevoke(key.kid)}
              >
                {revoking === key.kid ? '...' : 'Revoke'}
              </Button>
            </div>
          {/each}
        </div>
      {/if}

      {#if error}
        <p class="text-xs text-destructive mt-3">{error}</p>
      {/if}

      <div class="flex justify-end mt-4">
        <Button variant="outline" size="sm" onclick={onClose}>Close</Button>
      </div>
    </div>
  </div>
{/if}
