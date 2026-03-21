<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';
  import type { ZooidClient } from '@zooid/sdk';
  import type { ChannelInfo } from '../api';

  let {
    open,
    channel,
    client,
    defaultConfig,
    onClose,
    onSaved,
    onDeleted,
  }: {
    open: boolean;
    channel: ChannelInfo | null;
    client: ZooidClient;
    defaultConfig?: { storage?: { retention_days?: number } };
    onClose: () => void;
    onSaved: () => void;
    onDeleted: () => void;
  } = $props();

  let saving = $state(false);
  let error = $state('');
  let confirmDelete = $state(false);
  let deleting = $state(false);

  // Channel fields
  let name = $state('');
  let description = $state('');
  let tags = $state('');
  let isPublic = $state(true);

  // Config fields
  let retentionDays = $state('');
  let strictTypes = $state(false);
  let typesJson = $state('');

  $effect(() => {
    if (open && channel) {
      error = '';
      confirmDelete = false;

      name = channel.name;
      description = channel.description ?? '';
      tags = (channel.tags ?? []).join(', ');
      isPublic = channel.is_public;

      const cfg = channel.config as Record<string, unknown> | null;
      const storageCfg = cfg?.storage as Record<string, unknown> | null;
      retentionDays = storageCfg?.retention_days != null ? String(storageCfg.retention_days) : '';
      strictTypes = !!cfg?.strict_types;
      typesJson = cfg?.types ? JSON.stringify(cfg.types, null, 2) : '';
    }
  });

  async function handleSave(e: Event) {
    e.preventDefault();
    if (!channel) return;

    saving = true;
    error = '';

    // Build config
    let config: Record<string, unknown> | null = null;
    const hasConfig = retentionDays || typesJson || strictTypes;

    if (hasConfig) {
      config = {};
      if (retentionDays) {
        const num = parseInt(retentionDays, 10);
        if (!isNaN(num) && num > 0) config.storage = { retention_days: num };
      }
      if (typesJson.trim()) {
        try {
          config.types = JSON.parse(typesJson);
        } catch {
          error = 'Invalid JSON in types definition';
          saving = false;
          return;
        }
      }
      if (strictTypes) {
        if (!config.types) {
          error = 'strict_types requires types to be defined';
          saving = false;
          return;
        }
        config.strict_types = true;
      }
    }

    try {
      await client.updateChannel(channel.id, {
        name: name.trim() || undefined,
        description: description.trim() || null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : null,
        is_public: isPublic,
        config,
      });
      onSaved();
      onClose();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save';
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    if (!channel) return;
    if (!confirmDelete) {
      confirmDelete = true;
      return;
    }

    deleting = true;
    error = '';
    try {
      await client.deleteChannel(channel.id);
      onDeleted();
      onClose();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete';
    } finally {
      deleting = false;
    }
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

{#if open && channel}
  <div
    class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-label="Edit channel"
    tabindex="-1"
    onclick={handleBackdrop}
    onkeydown={handleKeydown}
  >
    <div class="bg-card border border-border rounded-lg shadow-lg w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
      <h2 class="font-semibold text-sm mb-1">Edit Channel</h2>
      <p class="text-xs text-muted-foreground mb-4 font-mono">{channel.id}</p>

      <form onsubmit={handleSave} class="flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Name</span>
          <Input bind:value={name} placeholder="Channel name" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Description</span>
          <Input bind:value={description} placeholder="What this channel is for" />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-muted-foreground">Tags (comma-separated)</span>
          <Input bind:value={tags} placeholder="ai, signals" />
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" bind:checked={isPublic} class="rounded border-border" />
          <span class="text-xs text-muted-foreground">Public channel</span>
        </label>

        <!-- Config section -->
        <div class="border-t border-border pt-3 mt-1">
          <div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Config</div>

          <div class="flex flex-col gap-3">
            <label class="flex flex-col gap-1">
              <span class="text-xs text-muted-foreground">Retention (days)</span>
              <Input bind:value={retentionDays} type="number" placeholder="Default ({defaultConfig?.storage?.retention_days ?? 7})" />
            </label>

            <label class="flex flex-col gap-1">
              <span class="text-xs text-muted-foreground">Event types (JSON)</span>
              <textarea
                bind:value={typesJson}
                placeholder={'{\n  "message": { ... },\n  "alert": { ... }\n}'}
                class="w-full bg-background border border-input rounded-md px-3 py-2 text-xs font-mono min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                spellcheck="false"
              ></textarea>
              <span class="text-[10px] text-muted-foreground/60">Define event type schemas as JSON</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" bind:checked={strictTypes} class="rounded border-border" />
              <span class="text-xs text-muted-foreground">Strict types (reject unknown types)</span>
            </label>
          </div>
        </div>

        {#if error}
          <p class="text-xs text-destructive">{error}</p>
        {/if}

        <div class="flex gap-2 mt-1">
          <Button type="submit" size="sm" class="flex-1" disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" size="sm" class="flex-1" onclick={onClose}>Cancel</Button>
        </div>

        <!-- Delete -->
        <div class="border-t border-border pt-3 mt-1">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            class="w-full text-[11px]"
            disabled={deleting}
            onclick={handleDelete}
          >
            {#if deleting}
              Deleting...
            {:else if confirmDelete}
              Confirm delete "{channel.id}"
            {:else}
              Delete channel
            {/if}
          </Button>
        </div>
      </form>
    </div>
  </div>
{/if}
