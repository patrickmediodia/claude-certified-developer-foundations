import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { estimateLines, splitBlocks } from '../src/content/blocks.js';
import { parseExamples } from '../src/content/examples.js';
import { MAX_CHUNK_LINES, parseNotes } from '../src/content/lessons.js';
import { loadModules } from '../src/content/modules.js';
import { isCorrect, parseQuiz } from '../src/content/quiz.js';
import { pickCheckQuestion } from '../src/content/relevance.js';
import { progressRow } from '../src/progress.js';
import { renderMarkdown } from '../src/ui/markdown.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('real repo content (01-mso-foundations)', () => {
  const modules = loadModules(root);
  const m1 = modules.find((m) => m.id === '01-mso-foundations')!;

  it('discovers module folders and parses module 1 without errors', () => {
    expect(modules.length).toBeGreaterThanOrEqual(1);
    expect(m1).toBeDefined();
    expect(m1.errors).toEqual([]);
    expect(m1.title).toMatch(/MSO Foundations/);
  });

  it('splits NOTES.md into bite-sized chunks with breadcrumbs', () => {
    expect(m1.chunks.length).toBeGreaterThanOrEqual(6);
    for (const c of m1.chunks) {
      expect(c.breadcrumb[0]).toBe(m1.title);
      expect(c.markdown.trim()).not.toBe('');
      // At most one table per chunk.
      expect(splitBlocks(c.markdown).filter((b) => b.kind === 'table').length).toBeLessThanOrEqual(1);
    }
    const ids = m1.chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(m1.chunks.some((c) => c.breadcrumb.length === 3)).toBe(true); // module › part › section
  });

  it('parses all 6 quiz questions with answers and multi-line rationales', () => {
    expect(m1.quizzes).toHaveLength(1);
    const qs = m1.quizzes[0]!.questions;
    expect(qs.map((q) => q.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
    expect(qs.map((q) => q.answer.join(''))).toEqual(['B', 'C', 'B', 'C', 'B', 'B']);
    for (const q of qs) {
      expect(q.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);
      expect(q.rationale.length).toBeGreaterThan(40);
    }
    // Q5's rationale wraps over several indented lines.
    expect(qs[4]!.rationale).toMatch(/thinking tokens count toward `max_tokens`/);
    // Q1's stem wraps over two lines.
    expect(qs[0]!.stem).toMatch(/rises steadily as the conversation goes on/);
  });

  it('parses EXAMPLES.md sections', () => {
    expect(m1.examples.map((e) => e.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(m1.examples[3]!.markdown).toContain('cache_control');
  });

  it('finds a relevant understanding-check question for the caching chunk', () => {
    const caching = m1.chunks.find((c) => c.markdown.includes('PREFIX MATCH'))!;
    const q = pickCheckQuestion(caching.markdown, m1.quizzes[0]!.questions, new Set());
    expect(q?.label).toBe('Q3');
  });

  it('domain context comes from NOTES.md and CLAUDE.md', () => {
    expect(m1.domainLine).toMatch(/16\.8%/);
  });
});

describe('quiz parser', () => {
  const md = `## Quiz 2

**Q1.** Which two are true? (Select two.)
- A. one
- B. two
  continues here
- C. three
- D. four

**Q2.** Single answer
- A. x
- B. y

<details>

- **Q1 → A, C.** Because A and C.
  More reasoning on a second line.
- **Q2 -> B.** y is right.
</details>
`;
  it('supports multiple-response answers and option continuation lines', () => {
    const r = parseQuiz(md, 'mod');
    expect(r.errors).toEqual([]);
    const [q1, q2] = r.value[0]!.questions;
    expect(q1!.answer).toEqual(['A', 'C']);
    expect(q1!.options[1]!.text).toBe('two continues here');
    expect(q1!.rationale).toBe('Because A and C.\nMore reasoning on a second line.');
    expect(q2!.answer).toEqual(['B']);
    expect(isCorrect(q1!, ['C', 'A'])).toBe(true);
    expect(isCorrect(q1!, ['A'])).toBe(false);
  });

  it('reports problems instead of throwing', () => {
    const r = parseQuiz('**Q1.** stem\n- A. only one option\n', 'mod');
    expect(r.value).toEqual([]);
    expect(r.errors.join('\n')).toMatch(/Q1/);
    expect(parseQuiz('', 'mod').errors).toEqual(['QUIZ.md: no questions found.']);
  });
});

describe('lesson chunking', () => {
  it('splits a long bullet list at item boundaries', () => {
    const items = Array.from({ length: 30 }, (_, i) => `- item ${i} ${'word '.repeat(10)}`).join('\n');
    const r = parseNotes(`# T\n\n## Part\n\n${items}\n`, 'T');
    expect(r.value.chunks.length).toBeGreaterThan(1);
    for (const c of r.value.chunks) {
      const lines = splitBlocks(c.markdown).reduce((n, b) => n + estimateLines(b), 0);
      expect(lines).toBeLessThanOrEqual(MAX_CHUNK_LINES);
    }
  });

  it('never splits inside a code fence', () => {
    const code = '```\n' + Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n') + '\n```';
    const r = parseNotes(`# T\n\n## P\n\nintro\n\n${code}\n\nafter\n`, 'T');
    expect(r.value.chunks.some((c) => c.markdown.includes('line 0') && c.markdown.includes('line 39'))).toBe(true);
  });

  it('parses example headings', () => {
    expect(parseExamples('## 1. A\nbody\n---\n## 2. B\nmore').value.map((e) => e.title)).toEqual(['A', 'B']);
  });
});

describe('rendering & progress row', () => {
  it('renders tables, bold and code blocks', () => {
    const out = renderMarkdown('**bold**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode()\n```', 60);
    expect(out).toContain('┌');
    expect(out).toContain('code()');
    expect(out).not.toContain('**');
  });

  it('formats a PROGRESS.md quiz-history row', () => {
    expect(
      progressRow({ date: '2026-10-23', topic: 'M1 · Quiz 1', score: 4, total: 6, weakSpots: ['Q2', 'Q5'] }),
    ).toBe('| 2026-10-23 | M1 · Quiz 1 | 4/6 (67%) | Q2; Q5 |');
  });
});
