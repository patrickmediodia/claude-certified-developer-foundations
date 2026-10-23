import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Module } from '../content/types.js';
import { moduleProgress, type Progress } from '../progress.js';
import { Frame } from '../ui/Frame.js';
import { Menu, type MenuItem } from '../ui/Menu.js';

export type ModuleAction =
  | { kind: 'learn'; start: number }
  | { kind: 'quiz'; quizId: string }
  | { kind: 'examples' }
  | { kind: 'back' };

/** First chunk not yet completed (or 0 when everything is done). */
export function resumeIndex(m: Module, progress: Progress): number {
  const done = new Set(moduleProgress(progress, m.id).completedChunks);
  const i = m.chunks.findIndex((c) => !done.has(c.id));
  return i < 0 ? 0 : i;
}

export function ModuleMenu(props: {
  module: Module;
  progress: Progress;
  onAction: (a: ModuleAction) => void;
}) {
  const m = props.module;
  const mp = moduleProgress(props.progress, m.id);
  const done = m.chunks.filter((c) => mp.completedChunks.includes(c.id)).length;
  const resume = resumeIndex(m, props.progress);

  const entries: { item: MenuItem; action: ModuleAction }[] = [];
  if (m.chunks.length) {
    entries.push({
      item: {
        label: done === 0 ? 'Learn — start the lesson' : done === m.chunks.length ? 'Learn — review from the start' : `Learn — continue at chunk ${resume + 1}/${m.chunks.length}`,
        hint: `${done}/${m.chunks.length} chunks done`,
      },
      action: { kind: 'learn', start: done === m.chunks.length ? 0 : resume },
    });
    if (done > 0 && done < m.chunks.length)
      entries.push({ item: { label: 'Learn — restart from chunk 1' }, action: { kind: 'learn', start: 0 } });
  }
  for (const q of m.quizzes) {
    const attempts = mp.quizAttempts.filter((a) => a.quizId === q.id);
    const last = attempts.at(-1);
    entries.push({
      item: {
        label: `Quiz — ${q.title}`,
        hint: last ? `last ${last.score}/${last.total} on ${last.date} (${attempts.length} attempt${attempts.length > 1 ? 's' : ''})` : `${q.questions.length} questions`,
      },
      action: { kind: 'quiz', quizId: q.id },
    });
  }
  if (m.examples.length)
    entries.push({ item: { label: 'Worked examples', hint: `${m.examples.length} examples` }, action: { kind: 'examples' } });
  entries.push({ item: { label: 'Back to modules' }, action: { kind: 'back' } });

  const [index, setIndex] = useState(0);
  useInput((input, key) => {
    if (key.escape || input === 'b') props.onAction({ kind: 'back' });
  });

  return (
    <Frame
      crumb={[m.title]}
      keys={[
        ['↑↓', 'move'],
        ['Enter', 'choose'],
        ['b/Esc', 'back'],
        ['Ctrl+C', 'quit'],
      ]}
    >
      <Text bold>{m.title}</Text>
      {m.domainLine ? <Text dimColor>Exam domain: {m.domainLine}</Text> : null}
      {!m.domainLine && m.domains.length ? (
        <Text dimColor>Exam domains: {m.domains.map((d) => `${d.name} (${d.weight})`).join(', ')}</Text>
      ) : null}
      <Box marginTop={1}>
        <Menu
          items={entries.map((e) => e.item)}
          index={index}
          onIndex={setIndex}
          onSelect={(i) => props.onAction(entries[i]!.action)}
        />
      </Box>
      {mp.quizAttempts.length ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Recent quiz attempts:</Text>
          {mp.quizAttempts.slice(-3).map((a, i) => (
            <Text key={i} dimColor>
              {'  '}
              {a.date} {a.quizTitle}: {a.score}/{a.total}
              {a.missed.length ? ` — missed ${a.missed.map((id) => id.split(':').at(-1)).join(', ')}` : ''}
            </Text>
          ))}
        </Box>
      ) : null}
      {m.errors.length ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Content problems (the rest still works):</Text>
          {m.errors.map((e, i) => (
            <Text key={i} color="red">
              {'  '}! {e}
            </Text>
          ))}
        </Box>
      ) : null}
    </Frame>
  );
}
