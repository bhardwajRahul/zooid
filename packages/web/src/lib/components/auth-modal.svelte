<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';

  let {
    open,
    currentToken,
    onSave,
    onLogout,
    onClose,
  }: {
    open: boolean;
    currentToken: string | null;
    onSave: (token: string) => Promise<boolean>;
    onLogout: () => void;
    onClose: () => void;
  } = $props();

  let tokenInput = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed || loading) return;

    error = '';
    loading = true;
    try {
      const ok = await onSave(trimmed);
      if (!ok) {
        error = 'Invalid token. Check that it is correct and not expired.';
      } else {
        tokenInput = '';
      }
    } catch {
      error = 'Failed to validate token. Is the server reachable?';
    } finally {
      loading = false;
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  // Clear error when modal reopens or input changes
  $effect(() => {
    if (open) error = '';
  });
</script>

{#if open}
  <div
    class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Authentication"
    tabindex="-1"
    onclick={handleBackdrop}
    onkeydown={handleKeydown}
  >
    <div class="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm p-6">
      <h2 class="font-semibold text-sm mb-1">Authentication</h2>
      <p class="text-xs text-muted-foreground mb-4">
        Paste an admin or publish token to unlock channels and publishing.
      </p>

      {#if currentToken}
        <div class="bg-secondary rounded-md px-3 py-2 mb-4">
          <div class="text-[10px] text-muted-foreground mb-1">Current token</div>
          <div class="text-xs font-mono truncate text-foreground/80">
            {currentToken.slice(0, 20)}...{currentToken.slice(-10)}
          </div>
        </div>
        <div class="flex gap-2">
          <Button variant="destructive" size="sm" class="flex-1" onclick={onLogout}>Sign out</Button>
          <Button variant="outline" size="sm" class="flex-1" onclick={onClose}>Close</Button>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="flex flex-col gap-3">
          <Input
            type="text"
            placeholder="eyJhbGci..."
            bind:value={tokenInput}
            oninput={() => error = ''}
            autocomplete="off"
            spellcheck="false"
          />
          {#if error}
            <p class="text-xs text-destructive">{error}</p>
          {/if}
          <div class="flex gap-2">
            <Button type="submit" size="sm" class="flex-1" disabled={!tokenInput.trim() || loading}>
              {loading ? 'Verifying...' : 'Sign in'}
            </Button>
            <Button variant="outline" size="sm" class="flex-1" onclick={onClose}>Cancel</Button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
