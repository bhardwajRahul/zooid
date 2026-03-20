<script lang="ts">
  import type { Component } from 'svelte';

  interface SettingsPageExtension {
    slug: string;
    label: string;
    icon?: Component;
  }

  let {
    serverName,
    onServerConfig,
    onKeysAndTokens,
    extensionSettingsPages = [],
    onExtensionSettings,
  }: {
    serverName: string;
    onServerConfig: () => void;
    onKeysAndTokens: () => void;
    extensionSettingsPages?: SettingsPageExtension[];
    onExtensionSettings?: (slug: string) => void;
  } = $props();

  let open = $state(false);

  function toggle() {
    open = !open;
  }

  function select(fn: () => void) {
    open = false;
    fn();
  }

  function handleBackdrop() {
    open = false;
  }
</script>

<div class="relative">
  <button
    onclick={toggle}
    class="flex items-center gap-1.5 font-semibold text-sm truncate hover:text-primary transition-colors"
    title="Server settings"
  >
    <span class="truncate">{serverName}</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-muted-foreground"><path d="m6 9 6 6 6-6"/></svg>
  </button>

  {#if open}
    <!-- Backdrop -->
    <button
      type="button"
      class="fixed inset-0 z-40"
      onclick={handleBackdrop}
      aria-label="Close menu"
      tabindex="-1"
    ></button>

    <!-- Dropdown -->
    <div class="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50 py-1">
      <button
        class="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors flex items-center gap-2"
        onclick={() => select(onServerConfig)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        Server config
      </button>
      <button
        class="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors flex items-center gap-2"
        onclick={() => select(onKeysAndTokens)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>
        Keys & tokens
      </button>
      {#each extensionSettingsPages as page}
        <button
          class="w-full text-left px-3 py-1.5 text-xs hover:bg-secondary transition-colors flex items-center gap-2"
          onclick={() => { if (onExtensionSettings) select(() => onExtensionSettings(page.slug)); }}
        >
          {#if page.icon}
            <svelte:component this={page.icon} size={14} />
          {/if}
          {page.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
