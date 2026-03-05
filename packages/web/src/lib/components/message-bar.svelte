<script lang="ts">
  import type { Content, JSONContent } from 'svelte-jsoneditor';
  import type { ChannelInfo } from '../api';

  let {
    channel,
    onPublish,
  }: {
    channel: ChannelInfo;
    onPublish: (payload: { type?: string; data: unknown }) => void;
  } = $props();

  let textInput = $state('');
  let editorContent = $state<Content>({ json: {} });
  let selectedType = $state<string>('message');
  let customType = $state('');
  let sending = $state(false);
  let typeDropdownOpen = $state(false);
  let JsonEditor = $state<typeof import('./json-editor.svelte').default | null>(null);

  // Lazy-load the JSON editor component
  async function loadEditor() {
    if (!JsonEditor) {
      const mod = await import('./json-editor.svelte');
      JsonEditor = mod.default;
    }
  }

  // Extract types from channel config
  let eventTypes = $derived.by(() => {
    const config = channel.config as { types?: Record<string, { schema?: Record<string, unknown> }> } | null;
    if (!config?.types) return [];
    return Object.keys(config.types);
  });

  // The active type name (from dropdown or custom input)
  let activeType = $derived(eventTypes.length > 0 ? selectedType : (customType.trim() || 'message'));

  // Get schema for selected type
  let selectedSchema = $derived.by(() => {
    if (!activeType) return null;
    const config = channel.config as { types?: Record<string, { schema?: Record<string, unknown> }> } | null;
    return config?.types?.[activeType]?.schema ?? null;
  });

  // Check if we should use the JSON editor
  let useJsonEditor = $derived.by(() => {
    if (!selectedSchema) return false;
    const props = (selectedSchema as { properties?: Record<string, { type?: string }> }).properties;
    if (!props) return false;
    const keys = Object.keys(props);
    // Single-key string schema = free text
    if (keys.length === 1 && props[keys[0]]?.type === 'string') return false;
    return true;
  });

  let freeTextKey = $derived.by(() => {
    if (useJsonEditor || !selectedSchema) return null;
    const props = (selectedSchema as { properties?: Record<string, unknown> }).properties;
    return props ? Object.keys(props)[0] : null;
  });

  // Generate a template object from schema properties
  function templateFromSchema(schema: Record<string, unknown> | null): Record<string, unknown> {
    if (!schema) return {};
    const props = (schema as { properties?: Record<string, { type?: string; enum?: unknown[]; default?: unknown }> }).properties;
    if (!props) return {};
    const obj: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(props)) {
      if (def.default !== undefined) {
        obj[key] = def.default;
      } else if (def.enum && def.enum.length > 0) {
        obj[key] = def.enum[0];
      } else {
        const defaults: Record<string, unknown> = {
          string: '',
          number: 0,
          boolean: false,
          array: [],
          object: {},
        };
        obj[key] = defaults[def.type ?? 'string'] ?? '';
      }
    }
    return obj;
  }

  function getSchemaForType(typeName: string): Record<string, unknown> | null {
    const config = channel.config as { types?: Record<string, { schema?: Record<string, unknown> }> } | null;
    return config?.types?.[typeName]?.schema ?? null;
  }

  // Reset state when channel or type changes
  let lastChannelId = '';
  let lastType = '';
  $effect(() => {
    const channelChanged = channel.id !== lastChannelId;
    const typeChanged = activeType !== lastType;

    if (channelChanged) {
      lastChannelId = channel.id;
      textInput = '';
      customType = '';
      const config = channel.config as { types?: Record<string, unknown> } | null;
      const types = config?.types ? Object.keys(config.types) : [];
      selectedType = types[0] ?? 'message';
    }

    if (channelChanged || typeChanged) {
      lastType = activeType;
      const schema = getSchemaForType(activeType);
      editorContent = { json: templateFromSchema(schema) };
      if (useJsonEditor) loadEditor();
    }
  });

  async function handleSubmit(e?: Event) {
    e?.preventDefault();
    if (sending) return;

    sending = true;
    try {
      if (!useJsonEditor) {
        const trimmed = textInput.trim();
        if (!trimmed) return;

        let data: unknown;
        if (freeTextKey) {
          data = { [freeTextKey]: trimmed };
        } else {
          // Try to parse as JSON, fall back to { message: ... }
          try {
            data = JSON.parse(trimmed);
          } catch {
            data = { message: trimmed };
          }
        }

        onPublish({ type: activeType, data });
        textInput = '';
      } else {
        // JSON editor mode
        let data: unknown;
        if ('json' in editorContent) {
          data = (editorContent as JSONContent).json;
        } else if ('text' in editorContent) {
          data = JSON.parse((editorContent as { text: string }).text);
        }

        onPublish({ type: activeType, data });
        editorContent = { json: templateFromSchema(selectedSchema) };
      }
    } catch {
      // Invalid JSON — don't clear
    } finally {
      sending = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function selectType(t: string) {
    selectedType = t;
    typeDropdownOpen = false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="border-t border-border mx-4 mb-3 mt-1 mb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-lg border bg-secondary/30 max-h-[250px] flex flex-col">
  <!-- Top row: type selector -->
  <div class="flex items-center gap-2 px-3 py-1.5 border-b border-border/50">
    {#if eventTypes.length > 0}
      <!-- Dropdown for configured types -->
      <div class="relative">
        <button
          class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          onclick={() => typeDropdownOpen = !typeDropdownOpen}
        >
          <span class="font-mono">{activeType}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {#if typeDropdownOpen}
          <div class="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-md shadow-lg py-1 z-10 min-w-[120px]">
            {#each eventTypes as t (t)}
              <button
                class="w-full text-left px-3 py-1 text-[11px] font-mono transition-colors
                  {activeType === t ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}"
                onclick={() => selectType(t)}
              >
                {t}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Free text type input -->
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-muted-foreground/50">type:</span>
        <input
          type="text"
          class="bg-transparent border-none outline-none text-[11px] font-mono text-muted-foreground w-20 placeholder:text-muted-foreground/30"
          placeholder="message"
          bind:value={customType}
        />
      </div>
    {/if}
  </div>

  <!-- Middle: input area -->
  <div class="px-3 py-2 flex-1 overflow-auto min-h-0">
    {#if !useJsonEditor}
      <input
        type="text"
        class="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/40"
        placeholder="Message #{channel.id}"
        bind:value={textInput}
        onkeydown={handleKeydown}
        autocomplete="off"
      />
    {:else if JsonEditor}
      <JsonEditor
        bind:content={editorContent}
        schema={selectedSchema}
      />
    {:else}
      <div class="text-sm text-muted-foreground/40 py-1">Loading editor...</div>
    {/if}
  </div>

  <!-- Bottom row: toolbar + send -->
  <div class="flex items-center justify-between px-3 py-1.5 border-t border-border/50">
    <div class="flex items-center gap-1">
      <!-- Placeholder slots for future toolbar buttons (markdown, emoji, etc.) -->
    </div>
    <button
      class="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors
        {(useJsonEditor || textInput.trim()) && !sending
          ? 'text-foreground hover:bg-secondary'
          : 'text-muted-foreground/30 cursor-default'}"
      disabled={!useJsonEditor && !textInput.trim() || sending}
      onclick={() => handleSubmit()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg>
    </button>
  </div>
</div>

{#if typeDropdownOpen}
  <!-- Backdrop to close dropdown -->
  <div class="fixed inset-0 z-5" onclick={() => typeDropdownOpen = false}></div>
{/if}
