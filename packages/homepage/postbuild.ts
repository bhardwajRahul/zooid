import { cpSync, existsSync } from 'fs';

// Copy pre-built docs into dist/docs/
const docsDistPath = '../../docs/dist';
if (existsSync(docsDistPath)) {
  cpSync(docsDistPath, 'dist/docs', { recursive: true });
  console.log('Copied docs into dist/docs/');
} else {
  console.warn('Warning: docs/dist not found, skipping docs copy');
}
