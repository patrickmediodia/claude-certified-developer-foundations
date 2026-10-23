import React, { useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { pickCheckQuestion, rankExamples } from '../content/relevance.js';
import type { Module, Question } from '../content/types.js';
import { CHROME_LINES, Frame, useSize, type KeyHelp } from '../ui/Frame.js';
import { renderMarkdown } from '../ui/markdown.js';
import { QuestionView, questionKeys } from '../ui/QuestionView.js';
import { ScrollView } from '../ui/ScrollView.js';
import { AskPanel, askKeys } from './AskPanel.js';
import { ExampleViewer, exampleKeys } from './ExampleViewer.js';

/** Run an understanding check after this many "Got it"s. */
export const CHECK_EVERY = 3;

type Mode =
  | { kind: 'chunk' }
  | { kind: 'ask'; phase: 'input' | 'streaming' | 'answered' | 'error' }
  | { kind: 'example' }
  | { kind: 'check'; question: Question; answered: boolean }
  | { kind: 'confirm' }
  | { kind: 'done' };

export function Learn(props: {
  module: Module;
  start: number;
  completed: string[];
  onChunkDone: (chunkId: string, index: number) => void;
  onCheck: (questionId: string, correct: boolean) => void;
  onExit: () => void;
  onQuiz: () => void;
}) {
  const m = props.module;
  const { columns, rows } = useSize();
  const width = columns - 2;
  const bodyHeight = rows - CHROME_LINES - 2;
  const [index, setIndex] = useState(Math.min(props.start, Math.max(0, m.chunks.length - 1)));
  const [mode, setMode] = useState<Mode>({ kind: 'chunk' });
  const [sinceCheck, setSinceCheck] = useState(0);
  const [usedChecks] = useState(() => new Set<string>());
  const [status, setStatus] = useState<string>();
  const chunk = m.chunks[index];
  const allQuestions = useMemo(() => m.quizzes.flatMap((q) => q.questions), [m]);
  const done = new Set(props.completed);

  const advance = () => {
    setMode({ kind: 'chunk' });
    if (index + 1 >= m.chunks.length) setMode({ kind: 'done' });
    else setIndex(index + 1);
  };

  const gotIt = () => {
    if (!chunk) return;
    props.onChunkDone(chunk.id, index);
    const count = sinceCheck + 1;
    const last = index + 1 >= m.chunks.length;
    if (count >= CHECK_EVERY || last) {
      setSinceCheck(0);
      const recent = m.chunks
        .slice(Math.max(0, index - count + 1), index + 1)
        .map((c) => c.markdown)
        .join('\n\n');
      const q = pickCheckQuestion(recent, allQuestions, usedChecks);
      if (q) {
        usedChecks.add(q.id);
        setMode({ kind: 'check', question: q, answered: false });
      } else if (last) setMode({ kind: 'done' });
      else setMode({ kind: 'confirm' });
    } else {
      setSinceCheck(count);
      advance();
    }
  };

  useInput(
    (input, key) => {
      setStatus(undefined);
      if (mode.kind === 'chunk') {
        if (key.return || input === 'g' || key.rightArrow) gotIt();
        else if (input === 'e' || input === '?') setMode({ kind: 'ask', phase: 'input' });
        else if (input === 'x') {
          if (m.examples.length) setMode({ kind: 'example' });
          else setStatus('No EXAMPLES.md for this module yet.');
        } else if (input === 'b' || key.leftArrow) {
          if (index === 0) props.onExit();
          else {
            setIndex(index - 1);
            setSinceCheck(Math.max(0, sinceCheck - 1));
          }
        } else if (key.escape || input === 'q') props.onExit();
      } else if (mode.kind === 'confirm') {
        if (key.return || input === 'y' || input === 'g') advance();
        else if (input === 'e' || input === '?') setMode({ kind: 'ask', phase: 'input' });
        else if (input === 'b' || input === 'n') setMode({ kind: 'chunk' });
        else if (key.escape) props.onExit();
      } else if (mode.kind === 'done') {
        if ((input === 'z' || key.return) && m.quizzes.length) props.onQuiz();
        else if (input === 'b') setMode({ kind: 'chunk' });
        else if (key.escape || input === 'q' || key.return) props.onExit();
      } else if (mode.kind === 'check' && !mode.answered && key.escape) {
        advance(); // skip the check
      }
    },
    { isActive: mode.kind !== 'ask' && mode.kind !== 'example' },
  );

  if (!chunk) {
    return (
      <Frame crumb={[m.title]} keys={[['Esc', 'back']]}>
        <Text color="yellow">This module has no lesson chunks yet.</Text>
      </Frame>
    );
  }

  const crumb = chunk.breadcrumb;
  const progressLabel = `Chunk ${index + 1}/${m.chunks.length}${chunk.part ? ` · part ${chunk.part.n}/${chunk.part.of}` : ''}${done.has(chunk.id) ? ' · ✓ done' : ''}`;

  let keys: KeyHelp;
  let body: React.ReactNode;
  switch (mode.kind) {
    case 'chunk':
      keys = [
        ['Enter', 'got it'],
        ['e', 'explain differently / ask'],
        ['x', 'show example'],
        ['b', 'back'],
        ['↑↓', 'scroll'],
        ['Esc', 'menu'],
      ];
      body = (
        <Box flexDirection="column">
          <Text dimColor>{progressLabel}</Text>
          <Text bold color="cyan" wrap="truncate-end">
            {crumb.at(-1)}
          </Text>
          <ScrollView text={renderMarkdown(chunk.markdown, width)} height={bodyHeight} resetKey={chunk.id} />
        </Box>
      );
      break;
    case 'ask':
      keys = askKeys(mode.phase);
      body = (
        <AskPanel
          chunk={chunk}
          width={width}
          height={bodyHeight + 2}
          onPhase={(phase) => setMode({ kind: 'ask', phase })}
          onClose={() => setMode({ kind: 'chunk' })}
        />
      );
      break;
    case 'example': {
      const ranked = rankExamples(chunk.markdown, m.examples);
      keys = exampleKeys;
      body = (
        <ExampleViewer
          examples={ranked}
          width={width}
          height={bodyHeight + 2}
          label="most relevant first"
          onClose={() => setMode({ kind: 'chunk' })}
        />
      );
      break;
    }
    case 'check':
      keys = [...questionKeys(mode.answered, mode.question.answer.length > 1), ...(mode.answered ? [] : ([['Esc', 'skip']] as KeyHelp))];
      body = (
        <Box flexDirection="column">
          <Text bold color="magentaBright">
            Quick understanding check
          </Text>
          <Text dimColor>One question from the module quiz that matches what you just read.</Text>
          <QuestionView
            question={mode.question}
            width={width}
            height={bodyHeight}
            onStatus={setStatus}
            onAnswered={(correct) => {
              props.onCheck(mode.question.id, correct);
              setMode({ ...mode, answered: true });
            }}
            onContinue={advance}
          />
        </Box>
      );
      break;
    case 'confirm':
      keys = [
        ['Enter/y', 'continue'],
        ['e', 'ask a question first'],
        ['b', 'reread this chunk'],
        ['Esc', 'menu'],
      ];
      body = (
        <Box flexDirection="column">
          <Text bold color="magentaBright">
            Checkpoint
          </Text>
          <Text>
            You've covered {CHECK_EVERY} chunks since the last check. Is everything clear so far, ready to continue?
          </Text>
          <Text dimColor>(No quiz question matched these chunks closely enough for a check.)</Text>
        </Box>
      );
      break;
    case 'done':
      keys = [
        ...(m.quizzes.length ? ([['Enter/z', 'take the quiz']] as KeyHelp) : []),
        ['b', 'back to last chunk'],
        ['Esc', 'menu'],
      ];
      body = (
        <Box flexDirection="column">
          <Text bold color="green">
            Lesson complete: {m.title}
          </Text>
          <Text>
            {props.completed.length}/{m.chunks.length} chunks marked as understood.
          </Text>
          {m.quizzes.length ? (
            <Text>Next step in the loop: test yourself with the exam-style quiz.</Text>
          ) : (
            <Text dimColor>No QUIZ.md for this module yet.</Text>
          )}
        </Box>
      );
      break;
  }

  return (
    <Frame crumb={crumb} keys={keys} status={status}>
      {body}
    </Frame>
  );
}
