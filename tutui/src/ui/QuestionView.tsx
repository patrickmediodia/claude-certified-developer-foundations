import React, { useMemo, useState } from 'react';
import { Box, useInput } from 'ink';
import chalk from 'chalk';
import wrapAnsi from 'wrap-ansi';
import { isCorrect } from '../content/quiz.js';
import type { Question } from '../content/types.js';
import { renderMarkdown } from './markdown.js';
import { ScrollView } from './ScrollView.js';

const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** Inline-markdown → ANSI for a single option line (bold, `code`). */
function inline(md: string, width: number): string {
  return renderMarkdown(md, width).replace(/\n+/g, ' ').trim();
}

export function questionText(
  q: Question,
  width: number,
  state: { cursor: number; selected: Set<string>; submitted: boolean },
): string {
  const multi = q.answer.length > 1;
  const out: string[] = [];
  out.push(chalk.bold.cyan(`${q.label}.`) + chalk.dim(`  ${q.quizTitle}`));
  out.push(renderMarkdown(q.stem, width));
  if (multi) {
    out.push(chalk.yellow(`(Select ${NUM_WORDS[q.answer.length] ?? q.answer.length}.)`));
  }
  out.push('');
  q.options.forEach((o, i) => {
    const picked = state.selected.has(o.letter);
    const correct = q.answer.includes(o.letter);
    const box = multi ? (picked ? '[x]' : '[ ]') : picked ? '(●)' : '( )';
    const pointer = !state.submitted && i === state.cursor ? chalk.cyan('❯') : ' ';
    let label = `${box} ${o.letter}. `;
    let body = inline(o.text, width - 10);
    if (state.submitted) {
      if (correct) {
        label = chalk.green(label);
        body = chalk.green(body) + chalk.green(' ✓');
      } else if (picked) {
        label = chalk.red(label);
        body = chalk.red(body) + chalk.red(' ✗');
      } else {
        label = chalk.dim(label);
        body = chalk.dim(body);
      }
    } else if (i === state.cursor) {
      label = chalk.bold(label);
    }
    const wrapped = wrapAnsi(body, Math.max(10, width - 10), { hard: true }).split('\n');
    out.push(`${pointer} ${label}${wrapped[0]}`);
    for (const l of wrapped.slice(1)) out.push(' '.repeat(9) + l);
  });
  if (state.submitted) {
    const right = isCorrect(q, [...state.selected]);
    out.push('');
    out.push(
      right
        ? chalk.bold.green('✓ Correct!')
        : chalk.bold.red('✗ Not quite.') +
            ` Correct answer: ${chalk.bold.green(q.answer.join(', '))}` +
            (state.selected.size ? chalk.dim(`  (you chose ${[...state.selected].sort().join(', ')})`) : ''),
    );
    out.push('');
    out.push(chalk.bold('Why:'));
    out.push(renderMarkdown(q.rationale || '_No rationale in the answer key._', width));
  }
  return out.join('\n');
}

/**
 * One exam-style question. ↑/↓ move, A–Z (or Space) select, Enter submits;
 * after submitting, Enter continues. Multi-response questions need exactly N picks.
 */
export function QuestionView(props: {
  question: Question;
  width: number;
  height: number;
  onAnswered?: (correct: boolean, selected: string[]) => void;
  onContinue: () => void;
  onStatus?: (msg: string | undefined) => void;
}) {
  const q = props.question;
  const multi = q.answer.length > 1;
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggle = (letter: string) => {
    setSelected((prev) => {
      if (!multi) return new Set([letter]);
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  const submit = (sel: Set<string>) => {
    if (multi && sel.size !== q.answer.length) {
      props.onStatus?.(`Select exactly ${q.answer.length} options (you have ${sel.size}).`);
      return;
    }
    if (sel.size === 0) return;
    setSelected(sel);
    setSubmitted(true);
    props.onStatus?.(undefined);
    props.onAnswered?.(isCorrect(q, [...sel]), [...sel].sort());
  };

  useInput((input, key) => {
    if (submitted) {
      if (key.return || key.rightArrow || input === 'n') props.onContinue();
      return;
    }
    if (key.upArrow) setCursor((c) => (c - 1 + q.options.length) % q.options.length);
    else if (key.downArrow) setCursor((c) => (c + 1) % q.options.length);
    else if (input === ' ') toggle(q.options[cursor]!.letter);
    else if (key.return) {
      // Single-response: Enter submits the marked option, or the one under the cursor.
      submit(multi || selected.size ? selected : new Set([q.options[cursor]!.letter]));
    } else if (/^[a-z]$/i.test(input)) {
      const idx = q.options.findIndex((o) => o.letter === input.toUpperCase());
      if (idx >= 0) {
        setCursor(idx);
        toggle(q.options[idx]!.letter);
      }
    }
  });

  const text = useMemo(
    () => questionText(q, props.width, { cursor, selected, submitted }),
    [q, props.width, cursor, selected, submitted],
  );
  return (
    <Box flexDirection="column">
      <ScrollView
        text={text}
        height={props.height}
        resetKey={`${q.id}:${submitted}`}
        keys={submitted ? 'all' : 'paging'}
      />
    </Box>
  );
}

export const questionKeys = (submitted: boolean, multi: boolean): [string, string][] =>
  submitted
    ? [['Enter', 'continue'], ['↑↓', 'scroll']]
    : [
        ['↑↓', 'move'],
        ['A–D', multi ? 'toggle' : 'select'],
        ...(multi ? ([['Space', 'toggle']] as [string, string][]) : []),
        ['Enter', 'submit'],
      ];
