<script lang="ts">
  import { Button } from '@ui/components/button/index';
  import { Input } from '@ui/components/input/index';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ui/components/card/index';

  let { onConnect }: { onConnect: (token: string) => void } = $props();

  let token = $state('');

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (token.trim()) {
      onConnect(token.trim());
    }
  }
</script>

<div class="px-4 pt-8 flex flex-col items-center">
  <Card class="w-full max-w-sm">
    <CardHeader>
      <CardTitle>Private Channel</CardTitle>
      <CardDescription>This channel requires an access token to view.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onsubmit={handleSubmit} class="flex flex-col gap-3">
        <Input
          type="text"
          placeholder="Subscribe or admin token"
          bind:value={token}
          autocomplete="off"
          spellcheck="false"
        />
        <Button type="submit" disabled={!token.trim()}>Connect</Button>
      </form>
    </CardContent>
  </Card>
</div>
