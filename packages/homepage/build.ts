import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  cpSync,
  existsSync,
} from 'fs';
import { Marked } from 'marked';

const readme = readFileSync('../../README.md', 'utf-8');
const marked = new Marked({
  renderer: {
    heading({ text, depth }) {
      const slug = text
        .toLowerCase()
        .replace(/<[^>]*>/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      return `<h${depth} id="${slug}">${text}</h${depth}>`;
    },
  },
});
let body = await marked.parse(readme);
body = body.replace(
  '<a href="https://dsc.gg/zooid">Discord</a>',
  '<a href="/SKILL.md">SKILL.md</a> · <a href="https://dsc.gg/zooid">Discord</a> · <a href="https://github.com/zooid-ai/zooid">Star on GitHub</a>',
);
body = body.replace(
  '<a href="https://zooid.dev/docs">Docs</a>',
  '<a href="/docs" class="docs-btn">Docs</a>',
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zooid — Pub/sub for AI agents</title>
  <meta name="description" content="Pub/sub for AI agents. Deploy in one command. Free forever.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    /* Palette: Pale Sky #bce0f0, Sky Aqua #52c4e0, Deep Space Blue #023047, Amber Flame #ffb703, Princeton Orange #fb8500 */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #c8dce8;
      background: linear-gradient(180deg, hsl(200, 80%, 6%) 0%, hsl(200, 95%, 14%) 40%, hsl(200, 70%, 12%) 100%);
      background-attachment: fixed;
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 2rem; margin: 1.5rem 0 1rem; color: #bce0f0; }
    h2 { font-size: 1.5rem; margin: 2rem 0 0.75rem; border-bottom: 1px solid #0a4a6b; padding-bottom: 0.3rem; color: #bce0f0; }
    h3 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; color: #8ecae6; }
    p { margin: 0.75rem 0; }
    a { color: #52c4e0; text-decoration: none; }
    a:hover { color: #8ecae6; text-decoration: underline; }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      background: hsl(200, 70%, 10%);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.9em;
      color: #bce0f0;
    }
    pre {
      background: hsl(200, 70%, 8%);
      border: 1px solid #0a4a6b;
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
      margin: 0.75rem 0;
    }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid #0a4a6b; margin: 2rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
    th, td {
      border: 1px solid #0a4a6b;
      padding: 0.5rem 0.75rem;
      text-align: left;
    }
    th { background: hsl(200, 70%, 10%); color: #8ecae6; }
    strong { color: #e0f0f8; }
    ul, ol { padding-left: 1.5rem; margin: 0.75rem 0; }
    li { margin: 0.25rem 0; }
    blockquote {
      border-left: 3px solid #fb8500;
      padding-left: 1rem;
      color: #8ba8be;
      margin: 0.75rem 0;
    }
    sub { color: #6a9ab8; }
    p[align="center"] { text-align: center; }
    h1[align="center"] { text-align: center; }
    a.docs-btn {
      background: #fb8500;
      color: #023047;
      padding: 0.3em 0.9em;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.95em;
    }
    a.docs-btn:hover { background: #ffb703; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
  </div>
</body>
</html>`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
copyFileSync('../../docs/public/favicon.svg', 'dist/favicon.svg');
copyFileSync('../../.claude/skills/zooid/SKILL.md', 'dist/SKILL.md');

// Copy pre-built docs into dist/docs/
// (docs are built before homepage via workspace dependency)
const docsDistPath = '../../docs/dist';
if (existsSync(docsDistPath)) {
  cpSync(docsDistPath, 'dist/docs', { recursive: true });
  console.log('Copied docs into dist/docs/');
} else {
  console.warn('Warning: docs/dist not found, skipping docs copy');
}

console.log('Built dist/index.html + SKILL.md + docs/');
