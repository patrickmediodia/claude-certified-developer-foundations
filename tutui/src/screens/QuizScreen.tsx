import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import type { Module, Question, Quiz } from '../content/types.js';
import { progressRow, today, type QuizAttempt } from '../progress.js';
import { CHROME_LINES, Frame, useSize } from '../ui/Frame.js';
import { QuestionView, questionKeys } from '../ui/QuestionView.js';
import { ScrollView } from '../ui/ScrollView.js';

interface Answer {
  question: Question;
  selected: string[];
  correct: boolean;
}

const shortStem = (q: Question, words = 7) => {
  const w = q.stem.replace(/`|\*\*/g, '').split(/\s+/);
  return w.slice(0, words).join(' ') + (w.length > words ? '…' : '');
};

/** "Module 1 — MSO Foundations (…)" + "Quiz 1 (6 questions)" → "Module 1 — MSO Foundations · Quiz 1" */
export const quizTopic = (m: Module, quiz: Quiz) =>
  `${m.title.replace(/\s*\(.*\)\s*$/, '')} · ${quiz.title.replace(/\s*\(.*\)\s*$/, '')}`;

export function summaryText(answers: Answer[]): string {
  const score = answers.filter((a) => a.correct).length;
  const missed = answers.filter((a) => !a.correct);
  const pct = Math.round((score / Math.max(1, answers.length)) * 100);
  const out: string[] = [];
  // The real exam pass mark is 720/1000 *scaled*; 72% raw is only a rough guide.
  const verdict = pct >= 72 ? chalk.green('≥ 72% (rough pass-mark guide)') : chalk.yellow('< 72% (rough pass-mark guide)');
  out.push(chalk.bold(`Score: ${score}/${answers.length} (${pct}%)`) + `  ${verdict}`);
  out.push('');
  if (missed.length) {
    out.push(chalk.bold('Missed questions:'));
    for (const a of missed) {
      out.push(
        `  ${chalk.red('✗')} ${chalk.bold(a.question.label)} ${shortStem(a.question, 12)}`,
      );
      out.push(
        `      you: ${a.selected.join(', ') || '—'}   correct: ${chalk.green(a.question.answer.join(', '))}`,
      );
    }
  } else out.push(chalk.green('No misses — clean sweep.'));
  return out.join('\n');
}

export function summaryRow(m: Module, quiz: Quiz, answers: Answer[], date: string): string {
  const score = answers.filter((a) => a.correct).length;
  const missed = answers.filter((a) => !a.correct);
  return progressRow({
    date,
    topic: quizTopic(m, quiz),
    score,
    total: answers.length,
    weakSpots: missed.map((a) => `${a.question.label} (${shortStem(a.question, 5)})`),
  });
}

export function QuizScreen(props: {
  module: Module;
  quiz: Quiz;
  onFinish: (attempt: QuizAttempt, progressRow: string) => void;
  onExit: () => void;
}) {
  const { module: m, quiz } = props;
  const { columns, rows } = useSize();
  const width = columns - 2;
  const bodyHeight = rows - CHROME_LINES - 1;
  const [questions, setQuestions] = useState(quiz.questions);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [status, setStatus] = useState<string>();
  const [date] = useState(today());
  const q = questions[idx];

  const restart = (qs: Question[]) => {
    setQuestions(qs);
    setIdx(0);
    setAnswers([]);
    setSubmitted(false);
    setFinished(false);
  };

  useInput((input, key) => {
    if (finished) {
      if (input === 'r') restart(quiz.questions);
      else if (input === 'm') {
        const missed = answers.filter((a) => !a.correct).map((a) => a.question);
        if (missed.length) restart(missed);
      } else if (key.escape || input === 'b' || key.return) props.onExit();
    } else if (key.escape) props.onExit();
  });

  if (finished) {
    const retryOnlyMissed = questions.length !== quiz.questions.length;
    return (
      <Frame
        crumb={[m.title, quiz.title, 'Results']}
        keys={[
          ['r', 'retake quiz'],
          ...(answers.some((a) => !a.correct) ? ([['m', 'retry missed only']] as [string, string][]) : []),
          ['↑↓', 'scroll'],
          ['Enter/Esc', 'back to module'],
        ]}
        status={retryOnlyMissed ? 'Retry of missed questions only (saved as its own attempt).' : 'Attempt saved to tutui/.progress.json'}
        statusColor="green"
      >
        <Text bold color="magentaBright">
          Quiz complete
        </Text>
        <ScrollView text={summaryText(answers)} height={Math.max(3, bodyHeight - 6)} />
        <Text bold>Paste into PROGRESS.md → "Quiz history" (also printed when you quit, for clean copying):</Text>
        <Text wrap="wrap">{summaryRow(m, quiz, answers, date)}</Text>
      </Frame>
    );
  }

  if (!q) {
    return (
      <Frame crumb={[m.title, quiz.title]} keys={[['Esc', 'back']]}>
        <Text color="yellow">This quiz has no questions.</Text>
      </Frame>
    );
  }

  return (
    <Frame
      crumb={[m.title, quiz.title]}
      keys={[...questionKeys(submitted, q.answer.length > 1), ['Esc', 'quit quiz']]}
      status={status}
    >
      <Text dimColor>
        Question {idx + 1}/{questions.length} · score so far {answers.filter((a) => a.correct).length}/{answers.length}
      </Text>
      <Box flexDirection="column">
        <QuestionView
          key={`${q.id}:${idx}:${questions.length}`}
          question={q}
          width={width}
          height={bodyHeight}
          onStatus={setStatus}
          onAnswered={(correct, selected) => {
            setSubmitted(true);
            setAnswers((prev) => [...prev, { question: q, selected, correct }]);
          }}
          onContinue={() => {
            setSubmitted(false);
            if (idx + 1 < questions.length) setIdx(idx + 1);
            else {
              setFinished(true);
              const all = answers; // already includes this question's answer
              props.onFinish(
                {
                date,
                quizId: quiz.id,
                quizTitle: questions.length === quiz.questions.length ? quiz.title : `${quiz.title} (missed retry)`,
                score: all.filter((a) => a.correct).length,
                total: all.length,
                missed: all.filter((a) => !a.correct).map((a) => a.question.id),
                },
                summaryRow(m, quiz, all, date),
              );
            }
          }}
        />
      </Box>
    </Frame>
  );
}
