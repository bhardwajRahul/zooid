import { describe, it, expect } from 'vitest';
import { parseGitHubUrl } from './github';

describe('parseGitHubUrl', () => {
  it('parses repo root URL', () => {
    const result = parseGitHubUrl('https://github.com/zooid-ai/trading-desk');
    expect(result).toEqual({
      owner: 'zooid-ai',
      repo: 'trading-desk',
      ref: 'main',
      path: '',
    });
  });

  it('parses URL with tree/branch/path', () => {
    const result = parseGitHubUrl(
      'https://github.com/zooid-ai/zooid/tree/main/examples/first-zooid',
    );
    expect(result).toEqual({
      owner: 'zooid-ai',
      repo: 'zooid',
      ref: 'main',
      path: 'examples/first-zooid',
    });
  });

  it('parses URL with non-main branch', () => {
    const result = parseGitHubUrl(
      'https://github.com/alice/research/tree/develop/templates/basic',
    );
    expect(result).toEqual({
      owner: 'alice',
      repo: 'research',
      ref: 'develop',
      path: 'templates/basic',
    });
  });

  it('handles trailing slashes', () => {
    const result = parseGitHubUrl('https://github.com/zooid-ai/trading-desk/');
    expect(result).toEqual({
      owner: 'zooid-ai',
      repo: 'trading-desk',
      ref: 'main',
      path: '',
    });
  });

  it('returns null for non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/foo/bar')).toBeNull();
  });

  it('returns null for invalid GitHub URLs', () => {
    expect(parseGitHubUrl('https://github.com/')).toBeNull();
    expect(parseGitHubUrl('https://github.com/only-owner')).toBeNull();
  });
});
