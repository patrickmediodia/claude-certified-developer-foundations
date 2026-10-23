import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { Module } from '../content/types.js';
import { moduleProgress, type Progress } from '../progress.js';
import { Frame } from '../ui/Frame.js';
import { Menu } from '../ui/Menu.js';

export function moduleSummary(m: Module, progress: Progress): string {
  if (!m.hasNotes && m.quizzes.length === 0) return 'no content yet';
  const mp = moduleProgress(progress, m.id);
  const done = m.chunks.filter((c) => mp.completedChunks.includes(c.id)).length;
  const parts = [`lesson ${done}/${m.chunks.length}`];
  const last = mp.quizAttempts.at(-1);
  if (last) {
    const best = Math.max(...mp.quizAttempts.map((a) => a.score / a.total));
    parts.push(`quiz last ${last.score}/${last.total}, best ${Math.round(best * 100)}%`);
  } else if (m.quizzes.length) parts.push('quiz not taken');
  return parts.join(' · ');
}

export function Home(props: {
  modules: Module[];
  progress: Progress;
  initialIndex?: number;
  onOpen: (moduleId: string) => void;
}) {
  const { exit } = useApp();
  const [index, setIndex] = useState(props.initialIndex ?? 0);
  const [status, setStatus] = useState<string>();
  useInput((input, key) => {
    if (input === 'q' || key.escape) exit();
  });

  const selected = props.modules[index];
  return (
    <Frame
      keys={[
        ['↑↓', 'move'],
        ['Enter', 'open module'],
        ['q', 'quit'],
      ]}
      status={status}
    >
      <Text bold>Pick a module</Text>
      <Text dimColor>Teach → check understanding → quiz → review. Content is read from the repo's 0*-*/ folders.</Text>
      <Box marginTop={1} flexDirection="column">
        {props.modules.length === 0 ? (
          <Text color="red">No module folders (0*-*/) found. Set TUTUI_ROOT to the repo root.</Text>
        ) : (
          <Menu
            items={props.modules.map((m) => ({
              label: m.title,
              hint: moduleSummary(m, props.progress),
              disabled: !m.hasNotes && m.quizzes.length === 0,
            }))}
            index={index}
            onIndex={(i) => {
              setIndex(i);
              setStatus(undefined);
            }}
            onSelect={(i) => {
              const m = props.modules[i]!;
              if (!m.hasNotes && m.quizzes.length === 0) {
                setIndex(i);
                setStatus(`${m.id}/ has no NOTES.md or QUIZ.md yet.`);
              } else props.onOpen(m.id);
            }}
          />
        )}
      </Box>
      {selected?.domains.length ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Exam domains covered:</Text>
          {selected.domains.map((d) => (
            <Text key={d.name}>
              {'  '}• {d.name} <Text color="yellow">{d.weight}</Text>
            </Text>
          ))}
        </Box>
      ) : null}
    </Frame>
  );
}
