import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app.js';
import { loadModules } from '../src/content/modules.js';
import { emptyProgress, type Progress } from '../src/progress.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modules = loadModules(root);

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const DOWN = '\u001B[B';
const ENTER = '\r';
// Strip ANSI so assertions see plain text.
const plain = (s = '') => s.replace(/\u001B\[[0-9;?]*[A-Za-z]/g, '');

function setup() {
  const saved: Progress[] = [];
  const r = render(<App modules={modules} initialProgress={emptyProgress()} save={(p) => void saved.push(p)} />);
  return { ...r, saved, frame: () => plain(r.lastFrame()) };
}

async function press(stdin: { write: (s: string) => void }, ...keys: string[]) {
  for (const k of keys) {
    stdin.write(k);
    await tick();
  }
}

describe('App (ink-testing-library)', () => {
  it('renders the home screen with modules, progress and key help', () => {
    const { frame, unmount } = setup();
    const f = frame();
    expect(f).toContain('tutui');
    expect(f).toContain('Pick a module');
    expect(f).toMatch(/Module 1 — MSO Foundations/);
    expect(f).toMatch(/lesson 0\/\d+/);
    expect(f).toContain('no content yet');
    expect(f).toContain('Model Selection & Optimisation');
    expect(f).toMatch(/Enter open module/);
    unmount();
  });

  it('opens a quiz question, grades an answer and shows the rationale', async () => {
    const { stdin, frame, unmount } = setup();
    await tick();
    await press(stdin, ENTER); // open module 1
    expect(frame()).toContain('Quiz — Quiz 1');
    // Menu: Learn, Quiz, Examples, Back -> move to Quiz.
    await press(stdin, DOWN, ENTER);
    let f = frame();
    expect(f).toContain('Question 1/6');
    expect(f).toContain('Q1.');
    expect(f).toMatch(/A\. Claude charges more per token/);
    await press(stdin, 'a', ENTER); // wrong answer (correct is B)
    f = frame();
    expect(f).toContain('Not quite.');
    expect(f).toMatch(/Correct answer: B/);
    expect(f).toContain('Why:');
    expect(f).toMatch(/stateless/i);
    await press(stdin, ENTER);
    expect(frame()).toContain('Question 2/6');
    unmount();
  });

  it('completes a full quiz and shows a PROGRESS.md row', async () => {
    const { stdin, frame, saved, unmount } = setup();
    await tick();
    await press(stdin, ENTER, DOWN, ENTER);
    const answers = ['b', 'c', 'b', 'c', 'a', 'b']; // Q5 wrong
    for (const a of answers) await press(stdin, a, ENTER, ENTER);
    const f = frame();
    expect(f).toContain('Quiz complete');
    expect(f).toContain('Score: 5/6 (83%)');
    expect(f).toMatch(/\| \d{4}-\d{2}-\d{2} \| Module 1 — MSO Foundations · Quiz 1 \| 5\/6 \(83%\) \| Q5 \(A request to Opus 5\.5/);
    const last = saved.at(-1)!;
    expect(last.modules['01-mso-foundations']!.quizAttempts[0]!.missed).toEqual([
      '01-mso-foundations:quiz-1-6-questions:Q5',
    ]);
    unmount();
  });

  it('learn mode shows a chunk with breadcrumb and records "Got it"', async () => {
    const { stdin, frame, saved, unmount } = setup();
    await tick();
    await press(stdin, ENTER, ENTER); // module → Learn
    let f = frame();
    expect(f).toMatch(/Chunk 1\/\d+/);
    expect(f).toContain('Enter got it');
    await press(stdin, ENTER);
    f = frame();
    expect(f).toMatch(/Chunk 2\/\d+/);
    expect(f).toContain('Part 1 — LLM & Technical Fundamentals');
    expect(saved.at(-1)!.modules['01-mso-foundations']!.completedChunks).toHaveLength(1);
    // Show example, then back.
    await press(stdin, 'x');
    expect(frame()).toMatch(/Example \d+\./);
    await press(stdin, 'b');
    expect(frame()).toMatch(/Chunk 2\/\d+/);
    unmount();
  });

  it('runs an understanding check after 3 chunks', async () => {
    const { stdin, frame, unmount } = setup();
    await tick();
    await press(stdin, ENTER, ENTER, ENTER, ENTER, ENTER);
    const f = frame();
    expect(f).toMatch(/Quick understanding check|Checkpoint/);
    unmount();
  });

  it('ask panel degrades gracefully when Claude is unavailable', async () => {
    process.env.TUTUI_OFFLINE = '1';
    const { stdin, frame, unmount } = setup();
    await tick();
    await press(stdin, ENTER, ENTER, 'e');
    expect(frame()).toContain('Ask Claude');
    await press(stdin, 'why?', ENTER);
    await tick(100);
    expect(frame()).toContain('Claude is disabled');
    await press(stdin, '\u001B');
    expect(frame()).toMatch(/Chunk 1\/\d+/);
    delete process.env.TUTUI_OFFLINE;
    unmount();
  });
});
