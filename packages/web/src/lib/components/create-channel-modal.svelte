<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';
  import type { ZooidClient } from '@zooid/sdk';

  let {
    open,
    client,
    onClose,
    onCreated,
  }: {
    open: boolean;
    client: ZooidClient;
    onClose: () => void;
    onCreated: (id: string) => void;
  } = $props();

  let id = $state('');
  let name = $state('');
  let description = $state('');
  let isPublic = $state(true);
  let creating = $state(false);
  let error = $state('');

  $effect(() => {
    if (open) {
      id = '';
      name = '';
      description = '';
      isPublic = true;
      error = '';
    }
  });

  // Auto-generate ID from name
  function handleNameInput() {
    if (!id || id === slugify(name.slice(0, -1))) {
      id = slugify(name);
    }
  }

  function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  }

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!id.trim() || !name.trim()) return;

    creating = true;
    error = '';

    try {
      await client.createChannel({
        id: id.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      });
      onCreated(id.trim());
      onClose();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create channel';
    } finally {
      creating = false;
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
    aria-label="Create channel"
    tabindex="-1"
    onclick={handleBackdrop}
    onkeydown={handleKeydown}
  >
    <div class="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm p-6">
      <h2 class="font-semibold text-sm mb-1">Create Channel</h2>
      <p class="text-xs text-muted-foreground mb-4">
        Create a new pub/sub channel.
      </p>

      <form onsubmit={handleCreate} class="flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Name</span>
          <Input bind:value={name} oninput={handleNameInput} placeholder="My Channel" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">ID (slug)</span>
          <Input bind:value={id} placeholder="my-channel" />
          <span class="text-[10px] text-muted-foreground/60">Lowercase, hyphens, 3-64 chars</span>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Description (optional)</span>
          <Input bind:value={description} placeholder="What this channel is for" />
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" bind:checked={isPublic} class="rounded border-border" />
          <span class="text-xs text-muted-foreground">Public channel</span>
        </label>

        {#if error}
          <p class="text-xs text-destructive">{error}</p>
        {/if}

        <div class="flex gap-2 mt-1">
          <Button type="submit" size="sm" class="flex-1" disabled={creating || !id.trim() || !name.trim()}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
          <Button variant="outline" size="sm" class="flex-1" onclick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  </div>
{/if}
