<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';
  import type { ZooidClient } from '@zooid/sdk';

  let {
    open,
    client,
    onClose,
  }: {
    open: boolean;
    client: ZooidClient;
    onClose: () => void;
  } = $props();

  let scopes = $state('pub:*, sub:*');
  let sub = $state('');
  let name = $state('');
  let expiresIn = $state('');
  let minting = $state(false);
  let error = $state('');
  let mintedToken = $state('');
  let copied = $state(false);

  $effect(() => {
    if (open) {
      error = '';
      mintedToken = '';
      copied = false;
    }
  });

  async function handleMint(e: Event) {
    e.preventDefault();
    minting = true;
    error = '';
    mintedToken = '';
    copied = false;

    const scopeList = scopes.split(',').map((s) => s.trim()).filter(Boolean);
    if (scopeList.length === 0) {
      error = 'At least one scope is required';
      minting = false;
      return;
    }

    try {
      const result = await client.mintToken({
        scopes: scopeList,
        sub: sub || undefined,
        name: name || undefined,
        expires_in: expiresIn || undefined,
      });
      mintedToken = result.token;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to mint token';
    } finally {
      minting = false;
    }
  }

  async function copyToken() {
    await navigator.clipboard.writeText(mintedToken);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
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
    aria-label="Mint token"
    tabindex="-1"
    onclick={handleBackdrop}
    onkeydown={handleKeydown}
  >
    <div class="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm p-6">
      <h2 class="font-semibold text-sm mb-1">Mint Token</h2>
      <p class="text-xs text-muted-foreground mb-4">
        Create a new JWT with custom scopes.
      </p>

      {#if mintedToken}
        <div class="flex flex-col gap-3">
          <div class="bg-secondary rounded-md p-3">
            <div class="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Token (shown once)</div>
            <div class="text-xs font-mono break-all select-all max-h-24 overflow-y-auto">{mintedToken}</div>
          </div>
          <div class="flex gap-2">
            <Button size="sm" class="flex-1" onclick={copyToken}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" class="flex-1" onclick={onClose}>Done</Button>
          </div>
        </div>
      {:else}
        <form onsubmit={handleMint} class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Scopes (comma-separated)</span>
            <Input bind:value={scopes} placeholder="admin, pub:my-channel, sub:*" />
            <span class="text-[10px] text-muted-foreground/60">admin, pub:channel, sub:channel, pub:*, sub:*</span>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Subject (optional)</span>
            <Input bind:value={sub} placeholder="my-bot" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Display name (optional)</span>
            <Input bind:value={name} placeholder="My Bot" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Expires in (optional)</span>
            <Input bind:value={expiresIn} placeholder="7d, 1h, 30m" />
            <span class="text-[10px] text-muted-foreground/60">Leave empty for no expiry</span>
          </label>

          {#if error}
            <p class="text-xs text-destructive">{error}</p>
          {/if}

          <div class="flex gap-2 mt-1">
            <Button type="submit" size="sm" class="flex-1" disabled={minting || !scopes.trim()}>
              {minting ? 'Minting...' : 'Mint'}
            </Button>
            <Button variant="outline" size="sm" class="flex-1" onclick={onClose}>Cancel</Button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
