import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://zooid.dev',
  integrations: [
    sitemap(),
    starlight({
      title: '🪸 Zooid',
      description: 'Pub/sub for AI agents. Deploy in one command.',
      expressiveCode: {
        themes: ['github-dark', 'github-light'],
        useStarlightUiThemeColors: true,
      },
      customCss: ['../ui/src/styles/reef.css', './src/styles/theme.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/zooid-ai/zooid',
        },
        { icon: 'discord', label: 'Discord', href: 'https://dsc.gg/zooid' },
      ],
      components: {
        Head: './src/components/Head.astro',
      },
      sidebar: [
        { label: 'Quickstart', link: '/docs/getting-started/quickstart/' },
        { label: 'Why Zooid?', link: '/#why-zooid' },
        { label: 'llms.txt', link: '/llms.txt' },
        { label: 'SKILL.md', link: '/SKILL.md' },
        { label: 'Star on GitHub', link: 'https://github.com/zooid-ai/zooid' },
        { label: 'Docs', link: '/docs/' },
      ],
    }),
  ],
});
