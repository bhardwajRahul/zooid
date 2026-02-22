import { describe, expect, it } from 'vitest';
import { looksLikeMarkdown, parsePretty, renderMarkdown } from './pretty-json';

describe('parsePretty', () => {
  it('parses flat object into text nodes', () => {
    const raw = JSON.stringify({ title: 'Hello', count: 42 });
    const nodes = parsePretty(raw);
    expect(nodes).toEqual([
      { kind: 'text', key: 'title', value: 'Hello', markdown: false },
      { kind: 'text', key: 'count', value: '42', markdown: false },
    ]);
  });

  it('preserves newlines in string values', () => {
    const raw = JSON.stringify({ body: 'line one\nline two\nline three' });
    const nodes = parsePretty(raw)!;
    expect(nodes[0].kind).toBe('text');
    const text = nodes[0] as Extract<(typeof nodes)[0], { kind: 'text' }>;
    expect(text.value).toBe('line one\nline two\nline three');
    expect(text.value.split('\n')).toEqual([
      'line one',
      'line two',
      'line three',
    ]);
  });

  it('parses nested object as group node', () => {
    const raw = JSON.stringify({ meta: { author: 'bot', version: 1 } });
    const nodes = parsePretty(raw)!;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('group');
    const group = nodes[0] as Extract<(typeof nodes)[0], { kind: 'group' }>;
    expect(group.key).toBe('meta');
    expect(group.children).toEqual([
      { kind: 'text', key: 'author', value: 'bot', markdown: false },
      { kind: 'text', key: 'version', value: '1', markdown: false },
    ]);
  });

  it('parses array of objects as list node', () => {
    const raw = JSON.stringify({
      posts: [
        { title: 'A', score: 10 },
        { title: 'B', score: 20 },
      ],
    });
    const nodes = parsePretty(raw)!;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('list');
    const list = nodes[0] as Extract<(typeof nodes)[0], { kind: 'list' }>;
    expect(list.items).toHaveLength(2);
    expect(list.items[0][0]).toEqual({
      kind: 'text',
      key: 'title',
      value: 'A',
      markdown: false,
    });
  });

  it('detects markdown in string values', () => {
    const raw = JSON.stringify({ summary: '**bold** and *italic*' });
    const nodes = parsePretty(raw)!;
    const text = nodes[0] as Extract<(typeof nodes)[0], { kind: 'text' }>;
    expect(text.markdown).toBe(true);
  });

  it('returns null for non-object JSON', () => {
    expect(parsePretty('"hello"')).toBeNull();
    expect(parsePretty('[1,2,3]')).toBeNull();
    expect(parsePretty('42')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parsePretty('not json')).toBeNull();
  });
});

describe('looksLikeMarkdown', () => {
  it('detects bold syntax', () => {
    expect(looksLikeMarkdown('some **bold** text')).toBe(true);
  });

  it('detects italic syntax', () => {
    expect(looksLikeMarkdown('some *italic* text')).toBe(true);
  });

  it('detects heading syntax', () => {
    expect(looksLikeMarkdown('# Heading')).toBe(true);
  });

  it('detects link syntax', () => {
    expect(looksLikeMarkdown('see [link](url)')).toBe(true);
  });

  it('detects code backticks', () => {
    expect(looksLikeMarkdown('use `code` here')).toBe(true);
  });

  it('does not flag plain text', () => {
    expect(looksLikeMarkdown('just a normal sentence')).toBe(false);
  });

  it('does not flag URLs without markdown', () => {
    expect(looksLikeMarkdown('https://example.com/path/to/page')).toBe(false);
  });
});

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    const html = renderMarkdown('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('renders bullet lists', () => {
    const html = renderMarkdown('* item one\n* item two');
    expect(html).toContain('<li>');
    expect(html).toContain('item one');
    expect(html).toContain('item two');
  });

  it('renders links', () => {
    const html = renderMarkdown('[click](https://example.com)');
    expect(html).toContain('<a');
    expect(html).toContain('https://example.com');
  });
});
