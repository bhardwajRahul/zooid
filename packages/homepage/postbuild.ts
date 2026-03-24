import { cpSync, existsSync, readFileSync, writeFileSync } from 'fs';

// Copy pre-built docs into dist/docs/
const docsDistPath = '../../docs/dist';
if (existsSync(docsDistPath)) {
  cpSync(docsDistPath, 'dist/docs', { recursive: true });
  console.log('Copied docs into dist/docs/');
} else {
  console.warn('Warning: docs/dist not found, skipping docs copy');
}

// Merge sitemap indexes: add docs sitemap reference to root sitemap-index.xml
const sitemapIndexPath = 'dist/sitemap-index.xml';
if (existsSync(sitemapIndexPath) && existsSync('dist/docs/sitemap-0.xml')) {
  const content = readFileSync(sitemapIndexPath, 'utf-8');
  const docsSitemapEntry =
    '  <sitemap><loc>https://zooid.dev/docs/sitemap-0.xml</loc></sitemap>';
  const merged = content.replace(
    '</sitemapindex>',
    `${docsSitemapEntry}\n</sitemapindex>`,
  );
  writeFileSync(sitemapIndexPath, merged);
  console.log('Merged docs sitemap into root sitemap-index.xml');
}
