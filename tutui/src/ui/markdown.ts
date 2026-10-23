import { Marked, type MarkedExtension, type Token, type Tokens } from 'marked';
import wrapAnsi from 'wrap-ansi';
import { markedTerminal } from 'marked-terminal';

const cache = new Map<number, Marked>();

const plainLen = (s: string) => s.replace(/\*\*|__|`/g, '').length;

/**
 * Compute cli-table3 column widths so a table fits in `width` columns
 * (water-filling: narrow columns keep their natural width, wide ones share the rest).
 */
export function fitColumns(natural: number[], width: number): number[] | undefined {
  const borders = natural.length + 1;
  const available = width - borders;
  if (natural.reduce((a, b) => a + b, 0) <= available) return undefined;
  const result = new Array<number>(natural.length).fill(0);
  let remaining = available;
  let open = natural.map((_, i) => i);
  while (open.length) {
    const share = Math.floor(remaining / open.length);
    const fits = open.filter((i) => natural[i]! <= share);
    if (fits.length === 0) {
      open.forEach((i) => (result[i] = Math.max(6, share)));
      break;
    }
    for (const i of fits) {
      result[i] = natural[i]!;
      remaining -= natural[i]!;
    }
    open = open.filter((i) => !fits.includes(i));
  }
  return result;
}

interface ParserCtx {
  parser: { parseInline(t: Token[]): string; parse(t: Token[]): string };
}

function renderList(ctx: ParserCtx, token: Tokens.List, width: number, indent: number): string {
  const start = typeof token.start === 'number' ? token.start : 1;
  const out: string[] = [];
  token.items.forEach((item, i) => {
    const marker = token.ordered ? `${start + i}. ` : '• ';
    const pad = ' '.repeat(indent + marker.length);
    const textParts: string[] = [];
    const nested: string[] = [];
    for (const t of item.tokens) {
      if (t.type === 'list') nested.push(renderList(ctx, t as Tokens.List, width, indent + marker.length));
      else if ((t.type === 'text' || t.type === 'paragraph') && 'tokens' in t && t.tokens)
        textParts.push(ctx.parser.parseInline(t.tokens));
      else if (t.type !== 'space') textParts.push(ctx.parser.parse([t]).trimEnd());
    }
    const text = (item.task ? (item.checked ? '[x] ' : '[ ] ') : '') + textParts.join(' ').replace(/\n/g, ' ');
    const wrapped = wrapAnsi(text, Math.max(10, width - pad.length), { hard: true, trim: true }).split('\n');
    out.push(' '.repeat(indent) + marker + (wrapped[0] ?? ''));
    for (const l of wrapped.slice(1)) out.push(pad + l);
    out.push(...nested);
  });
  return out.join('\n');
}

function getMarked(width: number): Marked {
  let m = cache.get(width);
  if (m) return m;
  // marked-terminal reads this object on every table render, so we mutate it per table.
  const tableOptions: Record<string, unknown> = { wordWrap: true, wrapOnWordBoundary: true };
  const ext = markedTerminal({
    width,
    reflowText: true,
    showSectionPrefix: false,
    tab: 2,
    tableOptions,
  }) as unknown as MarkedExtension;
  const original = ext.renderer?.table as ((t: Tokens.Table) => string) | undefined;
  if (ext.renderer && original) {
    ext.renderer.table = function (this: unknown, token: Tokens.Table) {
      const natural = token.header.map((h, c) =>
        Math.max(plainLen(h.text), ...token.rows.map((r) => plainLen(r[c]?.text ?? ''))) + 2,
      );
      const colWidths = fitColumns(natural, width);
      if (colWidths) tableOptions.colWidths = colWidths;
      else delete tableOptions.colWidths;
      return original.call(this, token);
    } as never;
  }
  // marked-terminal 7 prints inline tokens inside tight list items raw (`**bold**`);
  // render them through the inline parser instead.
  const originalText = ext.renderer?.text as ((t: Tokens.Text) => string) | undefined;
  if (ext.renderer && originalText) {
    ext.renderer.text = function (this: { parser: { parseInline(t: unknown[]): string } }, token: Tokens.Text) {
      if (typeof token === 'object' && token.tokens?.length) return this.parser.parseInline(token.tokens);
      return originalText.call(this, token);
    } as never;
  }
  // marked-terminal's own list renderer mangles nested lists (sub-bullets get renumbered
  // into the parent ordered list), so lists are rendered here with hanging indents.
  if (ext.renderer) {
    ext.renderer.list = function (this: ParserCtx, token: Tokens.List) {
      return renderList(this, token, width, 2) + '\n\n';
    } as never;
  }
  m = new Marked(ext);
  cache.set(width, m);
  return m;
}

/** Render markdown to an ANSI string wrapped to `width` columns. Never throws. */
export function renderMarkdown(markdown: string, width: number): string {
  const w = Math.max(30, Math.floor(width));
  try {
    const out = getMarked(w).parse(markdown, { async: false }) as string;
    return out.replace(/\n+$/, '');
  } catch (err) {
    return `${markdown}\n\n(markdown render failed: ${(err as Error).message})`;
  }
}
