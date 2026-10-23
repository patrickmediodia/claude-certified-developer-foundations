import { slugify } from './lessons.js';
import type { ParseResult, Question, Quiz } from './types.js';

const QUESTION = /^\s*\*\*Q(\d+)\.\*\*\s*(.*)$/;
const OPTION = /^\s*[-*]\s+([A-Z])[.)]\s+(.*)$/;
// - **Q1 → B.** rationale     /   - **Q3 → A, C.** rationale   (also accepts -> and "A and C")
const ANSWER = /^\s*[-*]\s+\*\*Q(\d+)\s*(?:→|->|=>|:)\s*([A-Z](?:\s*(?:,|&|and)\s*[A-Z])*)\s*\.?\s*\*\*\s*(.*)$/;
const H2 = /^##\s+(.*)$/;

interface Draft {
  number: number;
  stem: string[];
  options: { letter: string; text: string[] }[];
  answer?: string[];
  rationale?: string[];
}

interface Group {
  title: string;
  drafts: Draft[];
}

/**
 * Parse QUIZ.md. Questions (`**Q1.** stem` + `- A. option` lines) belong to the `##`
 * section they appear in. Answer-key lines (`- **Q1 → B.** rationale`, usually inside
 * `<details>`) attach to the most recent quiz section that has that question unanswered,
 * so both "key after each quiz" and "one key at the end" layouts work.
 */
export function parseQuiz(markdown: string, moduleId: string): ParseResult<Quiz[]> {
  const errors: string[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const groups: Group[] = [];
  let heading = 'Quiz';
  let group: Group | undefined;
  let draft: Draft | undefined;
  let mode: 'none' | 'stem' | 'option' | 'rationale' = 'none';
  let answerTarget: Draft | undefined;
  let inFence = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence) {
      const h = H2.exec(line);
      if (h) {
        heading = h[1]!.trim();
        group = undefined;
        mode = 'none';
        continue;
      }

      const a = ANSWER.exec(line);
      if (a) {
        const num = Number(a[1]);
        const target = [...groups]
          .reverse()
          .flatMap((g) => g.drafts)
          .find((d) => d.number === num && !d.answer);
        if (!target) {
          errors.push(`Answer key line for Q${num} has no matching unanswered question.`);
          mode = 'none';
          continue;
        }
        target.answer = a[2]!.split(/\s*(?:,|&|and)\s*/).map((s) => s.trim()).filter(Boolean).sort();
        target.rationale = a[3] ? [a[3]] : [];
        answerTarget = target;
        mode = 'rationale';
        continue;
      }

      const q = QUESTION.exec(line);
      if (q) {
        if (!group) {
          group = { title: heading, drafts: [] };
          groups.push(group);
        }
        draft = { number: Number(q[1]), stem: [q[2]!], options: [] };
        group.drafts.push(draft);
        mode = 'stem';
        continue;
      }

      if (draft && (mode === 'stem' || mode === 'option')) {
        const o = OPTION.exec(line);
        if (o) {
          draft.options.push({ letter: o[1]!, text: [o[2]!] });
          mode = 'option';
          continue;
        }
      }
    }

    if (line.trim() === '' || /^\s*<\/?(details|summary)/.test(line)) {
      if (mode === 'rationale') mode = 'none';
      else if (mode === 'option' && line.trim() === '') mode = 'none';
      continue;
    }
    if (mode === 'stem' && draft) draft.stem.push(line.trim());
    else if (mode === 'option' && draft && /^\s+/.test(raw)) draft.options.at(-1)!.text.push(line.trim());
    else if (mode === 'rationale' && answerTarget && /^\s+/.test(raw)) answerTarget.rationale!.push(line.trim());
    else if (mode !== 'stem') mode = 'none';
  }

  const quizzes: Quiz[] = [];
  for (const g of groups) {
    const quizSlug = slugify(g.title);
    const questions: Question[] = [];
    for (const d of g.drafts) {
      const where = `${g.title} Q${d.number}`;
      if (d.options.length < 2) {
        errors.push(`${where}: found ${d.options.length} option(s); expected "- A. ..." lines.`);
        continue;
      }
      if (!d.answer) {
        errors.push(`${where}: no answer-key line like "- **Q${d.number} → B.** rationale".`);
        continue;
      }
      const letters = new Set(d.options.map((o) => o.letter));
      const bad = d.answer.filter((l) => !letters.has(l));
      if (bad.length) {
        errors.push(`${where}: answer ${bad.join(', ')} is not one of the options.`);
        continue;
      }
      questions.push({
        id: `${moduleId}:${quizSlug}:Q${d.number}`,
        label: `Q${d.number}`,
        number: d.number,
        quizTitle: g.title,
        stem: d.stem.join('\n').trim(),
        options: d.options.map((o) => ({ letter: o.letter, text: o.text.join(' ').trim() })),
        answer: d.answer,
        rationale: (d.rationale ?? []).join('\n').trim(),
      });
    }
    if (questions.length) quizzes.push({ id: `${moduleId}:${quizSlug}`, title: g.title, questions });
  }
  if (quizzes.length === 0 && errors.length === 0) errors.push('QUIZ.md: no questions found.');
  return { value: quizzes, errors };
}

/** Exact-set grading for single and multiple-response questions. */
export function isCorrect(q: Question, selected: string[]): boolean {
  const s = [...new Set(selected)].sort();
  return s.length === q.answer.length && s.every((l, i) => l === q.answer[i]);
}
