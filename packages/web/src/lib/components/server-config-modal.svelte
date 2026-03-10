<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';
  import type { ZooidClient } from '@zooid/sdk';
  import type { ServerIdentity } from '../api';

  let {
    open,
    client,
    onClose,
    onSaved,
  }: {
    open: boolean;
    client: ZooidClient;
    onClose: () => void;
    onSaved: () => void;
  } = $props();

  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');

  let name = $state('');
  let description = $state('');
  let tags = $state('');
  let owner = $state('');
  let company = $state('');
  let email = $state('');

  $effect(() => {
    if (open) {
      error = '';
      loadMeta();
    }
  });

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
    try {
      await client.updateServerMeta({
        name: name || undefined,
        description: description || null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        owner: owner || null,
        company: company || null,
        email: email || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save';
    } finally {
      saving = false;
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
    aria-label="Server configuration"
    tabindex="-1"
    onclick={handleBackdrop}
    onkeydown={handleKeydown}
  >
    <div class="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm p-6">
      <h2 class="font-semibold text-sm mb-4">Server Configuration</h2>

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
            <Button type="submit" size="sm" class="flex-1" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" size="sm" class="flex-1" onclick={onClose}>Cancel</Button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
