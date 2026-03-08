<script lang="ts">
  import { createAvatar } from '@dicebear/core';
  import { glass } from '@dicebear/collection';
  import type { ZooidEvent } from '../api';

  let { event, size = 24 }: { event: ZooidEvent; size?: number } = $props();

  let seed = $derived(avatarSeed(event));
  let svg = $derived(createAvatar(glass, { seed, size }).toString());

  function avatarSeed(e: ZooidEvent): string {
    const id = e.publisher_id;
    const name = e.publisher_name;

    if (!id) return name ?? 'anonymous';

    const colonIdx = id.indexOf(':');
    const issuer = colonIdx > 0 ? id.slice(0, colonIdx) : id;
    const sub = colonIdx > 0 ? id.slice(colonIdx + 1) : null;

    if (sub) return `${sub}+${issuer}`;
    if (name) return `${name}+${issuer}`;
    return issuer;
  }
</script>

<span class="inline-flex shrink-0 rounded-full overflow-hidden" style="width: {size}px; height: {size}px">
  {@html svg}
</span>
