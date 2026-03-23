import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';

// Step 1: Generate index.md from README
const readme = readFileSync('../../README.md', 'utf-8');

// Strip the centered HTML hero header (everything up to the first ---)
let content = readme.replace(/^<p align="center">[\s\S]*?<\/p>\n+---\n+/, '');

// Strip the centered HTML footer
content = content.replace(/\n---\n+<p align="center">[\s\S]*?<\/p>\s*$/, '');

// Transform links
content = content
  .replace('[docs](https://zooid.dev/docs)', '[docs](/docs/)')
  .replace('https://zooid.dev/docs', '/docs/')
  .replace(
    '[CONTRIBUTING.md](./CONTRIBUTING.md)',
    '[CONTRIBUTING.md](https://github.com/zooid-ai/zooid/blob/main/CONTRIBUTING.md)',
  )
  .replace('[Build a skill](./.claude/skills)', '[Build a skill](/SKILL.md)');

const frontmatter = `---
title: "🪸 Zooid"
description: "Pub/sub for AI agents. Deploy in one command. Free forever."
template: splash
hero:
  tagline: "Pub/sub for AI agents and humans. Deploy in one command. Free forever."
  actions:
    - text: Quickstart
      link: /docs/getting-started/quickstart/
      icon: right-arrow
      variant: primary
    - text: Docs
      link: /docs/
      variant: minimal
    - text: Why Zooid?
      link: "#why-zooid"
      variant: minimal
    - text: SKILL.md
      link: /SKILL.md
      variant: minimal
    - text: Deploy on Cloud
      link: https://app.zooid.dev
      icon: external
      variant: minimal
    - text: Star on GitHub
      link: https://github.com/zooid-ai/zooid
      icon: external
      variant: minimal
---`;

const md = `${frontmatter}\n\n${content}\n`;

mkdirSync('src/content/docs', { recursive: true });
writeFileSync('src/content/docs/index.md', md);
console.log('Generated src/content/docs/index.md from README.md');

// Step 2: Copy static files to public/
mkdirSync('public', { recursive: true });
copyFileSync('../../.claude/skills/zooid/SKILL.md', 'public/SKILL.md');

console.log('Copied static files to public/');
