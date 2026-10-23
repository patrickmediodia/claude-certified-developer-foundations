/**
 * Minimal block-level markdown splitter. It doesn't render anything; it only finds
 * boundaries (paragraphs, lists, tables, fenced code) so long lesson sections can be
 * split into screen-sized chunks without breaking a table or code block in half.
 */

export type BlockKind = 'code' | 'table' | 'list' | 'para' | 'html';

export interface Block {
  kind: BlockKind;
  lines: string[];
}

const FENCE = /^\s*(```|~~~)/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+/;
const TABLE_ROW = /^\s*\|/;
const HR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

export function splitBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '' || HR.test(line)) {
      i++;
      continue;
    }
    if (FENCE.test(line)) {
      const fence = line.trim().slice(0, 3);
      const buf = [line];
      i++;
      while (i < lines.length) {
        buf.push(lines[i]!);
        if (lines[i]!.trim().startsWith(fence)) {
          i++;
          break;
        }
        i++;
      }
      blocks.push({ kind: 'code', lines: buf });
      continue;
    }
    if (TABLE_ROW.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && TABLE_ROW.test(lines[i]!)) buf.push(lines[i++]!);
      blocks.push({ kind: 'table', lines: buf });
      continue;
    }
    const kind: BlockKind = LIST_ITEM.test(line) ? 'list' : /^\s*</.test(line) ? 'html' : 'para';
    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i]!;
      if (l.trim() === '' || HR.test(l) || FENCE.test(l) || TABLE_ROW.test(l)) break;
      // A paragraph followed directly by a list starts a new block.
      if (kind === 'para' && buf.length > 0 && LIST_ITEM.test(l)) break;
      buf.push(l);
      i++;
    }
    blocks.push({ kind, lines: buf });
  }
  return blocks;
}

/** Splits a list block into groups of top-level items (each item keeps its continuation lines). */
export function splitListItems(block: Block): string[][] {
  const items: string[][] = [];
  const baseIndent = (LIST_ITEM.exec(block.lines[0]!)?.[1] ?? '').length;
  for (const l of block.lines) {
    const m = LIST_ITEM.exec(l);
    if (m && m[1]!.length <= baseIndent) items.push([l]);
    else if (items.length) items[items.length - 1]!.push(l);
    else items.push([l]);
  }
  return items;
}

const stripInline = (s: string) => s.replace(/\*\*|__|`/g, '');

/** Rough estimate of how many terminal lines a block renders to at `width` columns. */
export function estimateLines(block: Block, width = 76): number {
  const wrap = (s: string) => Math.max(1, Math.ceil(stripInline(s).length / width));
  switch (block.kind) {
    case 'code':
      return block.lines.length;
    case 'table': {
      const rows = block.lines.filter((l) => !/^\s*\|[\s:|-]+\|\s*$/.test(l));
      const cols = Math.max(1, rows[0] ? rows[0].split('|').length - 2 : 1);
      const colWidth = Math.max(8, Math.floor((width - cols - 1) / cols) - 2);
      let total = 1; // top border
      for (const r of rows) {
        const cells = r.split('|').slice(1, -1);
        const h = Math.max(1, ...cells.map((c) => Math.ceil(stripInline(c.trim()).length / colWidth)));
        total += h + 1; // row + separator line
      }
      return total;
    }
    case 'list':
      // Nested bullets and wrapped continuation lines each start a new rendered line.
      return block.lines.reduce((n, l) => n + wrap(l), 0);
    default:
      return wrap(block.lines.map((l) => l.trim()).join(' '));
  }
}

export const blockText = (b: Block) => b.lines.join('\n');
