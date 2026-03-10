<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';
  import type { ZooidClient, TrustedKey } from '@zooid/sdk';
  import { formatRelative } from '../time';

  let {
    client,
    onMenuClick,
  }: {
    client: ZooidClient;
    onMenuClick: () => void;
  } = $props();

  // --- Keys ---
  let keys = $state<TrustedKey[]>([]);
  let keysLoading = $state(false);
  let keysError = $state('');
  let revoking = $state<string | null>(null);

  async function loadKeys() {
    keysLoading = true;
    keysError = '';
    try {
      keys = await client.listKeys();
    } catch (err) {
      keysError = err instanceof Error ? err.message : 'Failed to load keys';
    } finally {
      keysLoading = false;
    }
  }

  async function handleRevoke(kid: string) {
    if (!confirm(`Revoke key "${kid}"? Tokens signed by this key will stop working.`)) return;
    revoking = kid;
    keysError = '';
    try {
      await client.revokeKey(kid);
      keys = keys.filter((k) => k.kid !== kid);
    } catch (err) {
      keysError = err instanceof Error ? err.message : 'Failed to revoke key';
    } finally {
      revoking = null;
    }
  }

  // --- Mint token ---
  let scopes = $state('pub:*, sub:*');
  let sub = $state('');
  let name = $state('');
  let expiresIn = $state('');
  let minting = $state(false);
  let mintError = $state('');
  let mintedToken = $state('');
  let copied = $state(false);

  async function handleMint(e: Event) {
    e.preventDefault();
    minting = true;
    mintError = '';
    mintedToken = '';
    copied = false;

    const scopeList = scopes.split(',').map((s) => s.trim()).filter(Boolean);
    if (scopeList.length === 0) {
      mintError = 'At least one scope is required';
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
      mintError = err instanceof Error ? err.message : 'Failed to mint token';
    } finally {
      minting = false;
    }
  }

  async function copyToken() {
    await navigator.clipboard.writeText(mintedToken);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function resetMint() {
    mintedToken = '';
    mintError = '';
    copied = false;
  }

  // Load keys on mount
  loadKeys();
</script>

<div class="flex-1 flex flex-col min-w-0">
  <!-- Header -->
  <div class="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0">
    <button
      onclick={onMenuClick}
      class="p-1 rounded hover:bg-secondary transition-colors md:hidden"
      aria-label="Open channels"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
    </button>
    <h1 class="text-sm font-semibold">Keys & Tokens</h1>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-lg mx-auto flex flex-col gap-8">

      <!-- Mint Token section -->
      <section>
        <h2 class="font-semibold text-sm mb-1">Mint Token</h2>
        <p class="text-xs text-muted-foreground mb-4">Create a new JWT with custom scopes.</p>

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
              <Button variant="outline" size="sm" class="flex-1" onclick={resetMint}>Mint another</Button>
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

            {#if mintError}
              <p class="text-xs text-destructive">{mintError}</p>
            {/if}

            <div class="flex gap-2 mt-1">
              <Button type="submit" size="sm" disabled={minting || !scopes.trim()}>
                {minting ? 'Minting...' : 'Mint'}
              </Button>
            </div>
          </form>
        {/if}
      </section>

      <!-- Signing Keys section -->
      <section>
        <h2 class="font-semibold text-sm mb-1">Signing Keys</h2>
        <p class="text-xs text-muted-foreground mb-4">Trusted keys used to verify JWT tokens.</p>

        {#if keysLoading}
          <p class="text-xs text-muted-foreground">Loading...</p>
        {:else if keys.length === 0}
          <p class="text-xs text-muted-foreground/60 text-center py-4">No keys found</p>
        {:else}
          <div class="flex flex-col gap-2">
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

        {#if keysError}
          <p class="text-xs text-destructive mt-3">{keysError}</p>
        {/if}
      </section>

    </div>
  </div>
</div>
