import { blockText, estimateLines, splitBlocks, splitListItems, type Block } from './blocks.js';
import type { Chunk, ParseResult } from './types.js';

/** Max estimated rendered lines per chunk before a section is split. */
export const MAX_CHUNK_LINES = 15;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'section';

const cleanHeading = (s: string) => s.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();

interface RawSection {
  part: string;
  section: string;
  body: string[];
}

export interface ParsedNotes {
  title: string;
  domainLine?: string;
  chunks: Chunk[];
}

/**
 * Parse a module's NOTES.md into chunks.
 * - `#` = module title, `##` = part, `###` = section.
 * - Content before the first `##` becomes an "Overview" section.
 * - Long sections split at paragraph / list-item boundaries, never inside tables or code.
 */
export function parseNotes(markdown: string, fallbackTitle: string): ParseResult<ParsedNotes> {
  const errors: string[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let title = fallbackTitle;
  let domainLine: string | undefined;
  const sections: RawSection[] = [];
  let current: RawSection = { part: 'Overview', section: 'Overview', body: [] };
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence) {
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) {
        const level = h[1]!.length;
        const text = cleanHeading(h[2]!);
        if (level === 1) {
          title = text;
          continue;
        }
        sections.push(current);
        current =
          level === 2
            ? { part: text, section: text, body: [] }
            : { part: current.part, section: text, body: [] };
        continue;
      }
      const d = /^\*\*Exam domain:\*\*\s*(.+)$/.exec(line.trim());
      if (d && !domainLine) domainLine = d[1]!.replace(/\*\*/g, '').trim();
    }
    current.body.push(line);
  }
  sections.push(current);
  if (inFence) errors.push('NOTES.md: unterminated ``` code fence.');

  const chunks: Chunk[] = [];
  for (const s of sections) {
    const blocks = splitBlocks(s.body.join('\n'));
    if (blocks.length === 0) continue;
    const groups = groupBlocks(blocks);
    const base = `${slugify(s.part)}/${slugify(s.section)}`;
    const breadcrumb = s.part === s.section ? [title, s.part] : [title, s.part, s.section];
    groups.forEach((g, n) => {
      chunks.push({
        id: `${base}#${n + 1}`,
        index: chunks.length,
        breadcrumb,
        markdown: g.map(blockText).join('\n\n'),
        part: groups.length > 1 ? { n: n + 1, of: groups.length } : undefined,
      });
    });
  }
  if (chunks.length === 0) errors.push('NOTES.md: no lesson content found.');
  return { value: { title, domainLine, chunks }, errors };
}

/** Group blocks into chunks of <= MAX_CHUNK_LINES with at most one table each. */
export function groupBlocks(input: Block[], maxLines = MAX_CHUNK_LINES): Block[][] {
  // First, break any single list that is too long into item groups.
  const blocks: Block[] = [];
  for (const b of input) {
    // Only bullet lists are split; splitting an ordered list would restart its numbering.
    const ordered = /^\s*\d+[.)]\s/.test(b.lines[0] ?? '');
    if (b.kind === 'list' && !ordered && estimateLines(b) > maxLines) {
      let buf: string[] = [];
      for (const item of splitListItems(b)) {
        const candidate: Block = { kind: 'list', lines: [...buf, ...item] };
        if (buf.length && estimateLines(candidate) > maxLines) {
          blocks.push({ kind: 'list', lines: buf });
          buf = [...item];
        } else buf = candidate.lines;
      }
      if (buf.length) blocks.push({ kind: 'list', lines: buf });
    } else blocks.push(b);
  }

  const groups: Block[][] = [];
  let cur: Block[] = [];
  let curLines = 0;
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
    curLines = 0;
  };
  blocks.forEach((b, idx) => {
    const n = estimateLines(b) + (cur.length ? 1 : 0);
    const isLast = idx === blocks.length - 1;
    const tooLong = curLines + n > maxLines;
    // Allow a short trailing block to stay with its predecessor instead of a tiny chunk.
    const tinyTail = isLast && n <= 4 && curLines + n <= maxLines + 6;
    const secondTable = b.kind === 'table' && cur.some((c) => c.kind === 'table');
    // Never leave a lone lead-in paragraph ("Three levers:") as its own chunk.
    const onlyLeadIn =
      cur.length === 1 && cur[0]!.kind === 'para' && /:\s*$/.test(cur[0]!.lines.at(-1) ?? '');
    if (cur.length && ((tooLong && !tinyTail && !onlyLeadIn) || secondTable)) {
      // Keep a lead-in paragraph ("Two key points:") with what it introduces.
      const prev = cur[cur.length - 1]!;
      const carry =
        cur.length > 1 && prev.kind === 'para' && /:\s*$/.test(prev.lines.at(-1) ?? '')
          ? cur.pop()
          : undefined;
      flush();
      if (carry) {
        cur.push(carry);
        curLines = estimateLines(carry);
      }
    }
    curLines += estimateLines(b) + (cur.length ? 1 : 0);
    cur.push(b);
  });
  flush();
  return groups;
}
