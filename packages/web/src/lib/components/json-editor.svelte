<script lang="ts">
  import { JSONEditor, createAjvValidator, Mode } from 'svelte-jsoneditor';
  import type { Content } from 'svelte-jsoneditor';

  let {
    content = $bindable({ json: {} }),
    schema,
  }: {
    content: Content;
    schema?: Record<string, unknown> | null;
  } = $props();

  let validator = $derived.by(() => {
    if (!schema) return undefined;
    try {
      return createAjvValidator({ schema });
    } catch {
      return undefined;
    }
  });
</script>

<div class="json-editor-wrapper">
  <JSONEditor
    bind:content
    mode={Mode.text}
    mainMenuBar={false}
    navigationBar={false}
    statusBar={false}
    {validator}
  />
</div>

<style>
  .json-editor-wrapper {
    --jse-theme-color: oklch(0.21 0 0);
    --jse-theme-color-highlight: oklch(0.25 0 0);
    --jse-background-color: oklch(0.18 0 0);
    --jse-text-color: oklch(0.85 0 0);
    --jse-panel-background: oklch(0.15 0 0);
    --jse-panel-border: oklch(0.25 0 0);
    --jse-main-border: 1px solid oklch(0.25 0 0);
    --jse-key-color: oklch(0.7 0.1 200);
    --jse-value-color-string: oklch(0.75 0.1 150);
    --jse-value-color-number: oklch(0.75 0.1 60);
    --jse-delimiter-color: oklch(0.5 0 0);
    --jse-error-color: oklch(0.65 0.2 25);
    border-radius: 0.375rem;
    overflow: hidden;
    max-height: 150px;
  }

  .json-editor-wrapper :global(.jse-text-mode) {
    min-height: 60px;
    max-height: 150px;
  }
</style>
