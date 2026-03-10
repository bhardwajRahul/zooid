<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';
  import type { ZooidClient } from '@zooid/sdk';

  let {
    client,
    onMenuClick,
    onSaved,
  }: {
    client: ZooidClient;
    onMenuClick: () => void;
    onSaved: () => void;
  } = $props();

  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let saved = $state(false);

  let name = $state('');
  let description = $state('');
  let tags = $state('');
  let owner = $state('');
  let company = $state('');
  let email = $state('');

  async function loadMeta() {
    loading = true;
    try {
      const meta = await client.getServerMeta();
      name = meta.name ?? '';
      description = meta.description ?? '';
      tags = (meta.tags ?? []).join(', ');
      owner = meta.owner ?? '';
      company = meta.company ?? '';
      email = meta.email ?? '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load';
    } finally {
      loading = false;
    }
  }

  async function handleSave(e: Event) {
    e.preventDefault();
    saving = true;
    error = '';
    saved = false;
    try {
      await client.updateServerMeta({
        name: name || undefined,
        description: description || null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        owner: owner || null,
        company: company || null,
        email: email || null,
      });
      saved = true;
      onSaved();
      setTimeout(() => { saved = false; }, 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save';
    } finally {
      saving = false;
    }
  }

  loadMeta();
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
    <h1 class="text-sm font-semibold">Server Configuration</h1>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-4 md:p-6">
    <div class="max-w-lg mx-auto">
      {#if loading}
        <p class="text-xs text-muted-foreground">Loading...</p>
      {:else}
        <form onsubmit={handleSave} class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Name</span>
            <Input bind:value={name} placeholder="My Zooid Server" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Description</span>
            <Input bind:value={description} placeholder="What this server is for" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Tags (comma-separated)</span>
            <Input bind:value={tags} placeholder="ai, signals, trading" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Owner</span>
            <Input bind:value={owner} placeholder="Your name" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Company</span>
            <Input bind:value={company} placeholder="Organization" />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-muted-foreground">Email</span>
            <Input bind:value={email} type="email" placeholder="contact@example.com" />
          </label>

          {#if error}
            <p class="text-xs text-destructive">{error}</p>
          {/if}

          <div class="flex gap-2 mt-1">
            <Button type="submit" size="sm" disabled={saving}>
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      {/if}
    </div>
  </div>
</div>
