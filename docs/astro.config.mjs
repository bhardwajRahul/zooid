import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypeDoc from 'starlight-typedoc';
import starlightCopyButton from 'starlight-copy-button';

export default defineConfig({
  site: 'https://zooid.dev',
  base: '/docs',
  integrations: [
    starlight({
      title: '🪸 Zooid',
      description: 'Pub/sub for AI agents. Deploy in one command.',
      customCss: ['./src/styles/theme.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/zooid-ai/zooid',
        },
        { icon: 'discord', label: 'Discord', href: 'https://dsc.gg/zooid' },
      ],
      editLink: {
        baseUrl: 'https://github.com/zooid-ai/zooid/edit/main/docs/',
      },
      components: {
        Head: './src/components/Head.astro',
      },
      plugins: [
        starlightCopyButton(),
        starlightTypeDoc({
          entryPoints: ['../packages/sdk/src/index.ts'],
          tsconfig: '../packages/sdk/tsconfig.json',
          output: 'reference/sdk',
          sidebar: {
            label: 'SDK Reference',
            collapsed: true,
          },
          typeDoc: {
            excludePrivate: true,
            excludeInternal: true,
            skipErrorChecking: true,
          },
        }),
        starlightTypeDoc({
          entryPoints: ['../packages/types/src/index.ts'],
          tsconfig: '../packages/types/tsconfig.json',
          output: 'reference/types',
          sidebar: {
            label: 'Types Reference',
            collapsed: true,
          },
          typeDoc: {
            excludePrivate: true,
            excludeInternal: true,
            skipErrorChecking: true,
          },
        }),
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Quickstart', slug: 'getting-started/quickstart' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Concepts', slug: 'getting-started/concepts' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Deploying', slug: 'guides/deploying' },
            { label: 'Authentication', slug: 'guides/authentication' },
            { label: 'Channels', slug: 'guides/channels' },
            { label: 'Publishing', slug: 'guides/publishing' },
            { label: 'Subscribing', slug: 'guides/subscribing' },
            { label: 'Webhooks', slug: 'guides/webhooks' },
            { label: 'Web', slug: 'guides/web' },
            { label: 'Schema Validation', slug: 'guides/schema-validation' },
            { label: 'Directory', slug: 'guides/directory' },
          ],
        },
        {
          label: 'CLI Reference',
          items: [
            { label: 'Overview', slug: 'cli' },
            { label: 'zooid init', slug: 'cli/init' },
            { label: 'zooid deploy', slug: 'cli/deploy' },
            { label: 'zooid dev', slug: 'cli/dev' },
            { label: 'zooid channel', slug: 'cli/channel' },
            { label: 'zooid publish', slug: 'cli/publish' },
            { label: 'zooid tail', slug: 'cli/tail' },
            { label: 'zooid subscribe', slug: 'cli/subscribe' },
            { label: 'zooid token', slug: 'cli/token' },
            { label: 'zooid config', slug: 'cli/config' },
            { label: 'zooid status', slug: 'cli/status' },
            { label: 'zooid history', slug: 'cli/history' },
            { label: 'zooid server', slug: 'cli/server' },
            { label: 'zooid share', slug: 'cli/share' },
            { label: 'zooid unshare', slug: 'cli/unshare' },
            { label: 'zooid discover', slug: 'cli/discover' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', slug: 'api' },
            {
              label: 'REST',
              items: [
                { label: 'Channels', slug: 'api/channels' },
                { label: 'Events', slug: 'api/events' },
                { label: 'Webhooks', slug: 'api/webhooks' },
                { label: 'Tokens', slug: 'api/tokens' },
                { label: 'Server', slug: 'api/server' },
                { label: 'Directory', slug: 'api/directory' },
                { label: 'Keys', slug: 'api/keys' },
              ],
            },
            {
              label: 'Protocols',
              items: [
                { label: 'Well-Known', slug: 'api/well-known' },
                { label: 'WebSocket', slug: 'api/websocket' },
                { label: 'Feeds (RSS, JSON, OPML)', slug: 'api/feeds' },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
