import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

export type PrettyNode =
  | {
      kind: 'text';
      key: string;
      value: string;
      markdown: boolean;
      multiline: boolean;
    }
  | { kind: 'group'; key: string; children: PrettyNode[] }
  | { kind: 'list'; key: string; items: PrettyNode[][] };

const MD_HINT = /[*_#\[`~>]|\n[-*] |\n\d+\. /;

export function looksLikeMarkdown(s: string): boolean {
  return MD_HINT.test(s);
}

export function renderMarkdown(s: string): string {
  return marked.parse(s, { async: false }) as string;
}

export function parsePretty(raw: string): PrettyNode[] | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj))
      return null;
    return objectToNodes(obj);
  } catch {
    return null;
  }
}

export function objectToNodes(obj: Record<string, unknown>): PrettyNode[] {
  return Object.entries(obj).map(([key, value]) => {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return {
        kind: 'group' as const,
        key,
        children: objectToNodes(value as Record<string, unknown>),
      };
    }
    if (Array.isArray(value) && value.length > 0) {
      return {
        kind: 'list' as const,
        key,
        items: value.map((item) =>
          typeof item === 'object' && item !== null && !Array.isArray(item)
            ? objectToNodes(item as Record<string, unknown>)
            : [
                {
                  kind: 'text' as const,
                  key: '',
                  value: String(item),
                  markdown: false,
                  multiline: false,
                },
              ],
        ),
      };
    }
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    const multiline = str.includes('\n');
    return {
      kind: 'text' as const,
      key,
      value: str,
      markdown: looksLikeMarkdown(str),
      multiline,
    };
  });
}
