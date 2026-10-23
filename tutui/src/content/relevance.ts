import type { Example, Question } from './types.js';

const STOP = new Set(
  `that this with from what which when your into than then they them there their have
  does done more most only also each such like just will would should could about after
  before every other these those while where being been were here over under same some
  always never best true false following statement correct option options`.split(/\s+/),
);

/** Bag of significant terms; `code spans` count triple since they are precise topic markers. */
export function terms(markdown: string): Map<string, number> {
  const out = new Map<string, number>();
  const add = (t: string, w: number) => out.set(t, Math.max(out.get(t) ?? 0, w));
  for (const m of markdown.matchAll(/`([^`]+)`/g)) add(m[1]!.toLowerCase().trim(), 3);
  for (const w of markdown.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? []) {
    if (!STOP.has(w)) add(w.replace(/s$/, ''), 1);
  }
  return out;
}

export function overlap(a: Map<string, number>, b: Map<string, number>): number {
  let score = 0;
  for (const [t, w] of a) if (b.has(t)) score += Math.max(w, b.get(t)!);
  return score;
}

const questionText = (q: Question) =>
  [q.stem, ...q.options.map((o) => o.text), q.rationale].join('\n');

/** Most relevant unused question for the given lesson text, or undefined if none is relevant enough. */
export function pickCheckQuestion(
  lessonMarkdown: string,
  questions: Question[],
  exclude: Set<string>,
  minScore = 5,
): Question | undefined {
  const lt = terms(lessonMarkdown);
  let best: { q: Question; s: number } | undefined;
  for (const q of questions) {
    if (exclude.has(q.id)) continue;
    const s = overlap(lt, terms(questionText(q)));
    if (s >= minScore && (!best || s > best.s)) best = { q, s };
  }
  return best?.q;
}

/** Examples sorted by relevance to the lesson text (all examples kept, best first). */
export function rankExamples(lessonMarkdown: string, examples: Example[]): Example[] {
  const lt = terms(lessonMarkdown);
  return examples
    .map((e, i) => ({ e, i, s: overlap(lt, terms(`${e.title}\n${e.markdown}`)) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.e);
}
