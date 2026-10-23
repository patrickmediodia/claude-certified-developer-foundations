import type { Example, ParseResult } from './types.js';

/** Parse EXAMPLES.md: every `## N. Title` heading starts an example. */
export function parseExamples(markdown: string): ParseResult<Example[]> {
  const examples: Example[] = [];
  let cur: { number: number; title: string; body: string[] } | undefined;
  let inFence = false;
  const push = () => {
    if (!cur) return;
    const md = cur.body
      .join('\n')
      .replace(/\n\s*---\s*$/m, '')
      .trim();
    examples.push({ number: cur.number, title: cur.title, markdown: md });
  };
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const m = inFence ? null : /^##\s+(\d+)[.)]\s+(.*)$/.exec(line);
    if (m) {
      push();
      cur = { number: Number(m[1]), title: m[2]!.trim(), body: [] };
    } else if (!inFence && /^#{1,2}\s/.test(line)) {
      push();
      cur = undefined;
    } else if (cur && !(!inFence && /^\s*---\s*$/.test(line))) {
      cur.body.push(line);
    }
  }
  push();
  return {
    value: examples,
    errors: examples.length ? [] : ['EXAMPLES.md: no "## N. Title" sections found.'],
  };
}
