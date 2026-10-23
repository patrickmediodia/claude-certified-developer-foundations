import React, { useCallback, useState } from 'react';
import { Text } from 'ink';
import type { Module } from './content/types.js';
import { moduleProgress, saveProgress, updateModule, today, type Progress } from './progress.js';
import { CHROME_LINES, Frame, useSize } from './ui/Frame.js';
import { ExampleViewer, exampleKeys } from './screens/ExampleViewer.js';
import { Home } from './screens/Home.js';
import { Learn } from './screens/Learn.js';
import { ModuleMenu } from './screens/ModuleMenu.js';
import { QuizScreen } from './screens/QuizScreen.js';

type Route =
  | { name: 'home' }
  | { name: 'module'; moduleId: string }
  | { name: 'learn'; moduleId: string; start: number }
  | { name: 'quiz'; moduleId: string; quizId: string }
  | { name: 'examples'; moduleId: string };

export interface AppProps {
  modules: Module[];
  initialProgress: Progress;
  /** Persist progress; returns an error message on failure. Injected so tests don't write files. */
  save?: (p: Progress) => string | undefined;
  /** Called with each PROGRESS.md row produced this session (the CLI prints them on exit). */
  onProgressRow?: (row: string) => void;
}

export function App({ modules, initialProgress, save = saveProgress, onProgressRow }: AppProps) {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [progress, setProgress] = useState(initialProgress);
  const [saveError, setSaveError] = useState<string>();
  const { columns, rows } = useSize();

  const update = useCallback(
    (moduleId: string, fn: Parameters<typeof updateModule>[2]) => {
      setProgress((prev) => {
        const next = updateModule(prev, moduleId, fn);
        setSaveError(save(next));
        return next;
      });
    },
    [save],
  );

  const mod = 'moduleId' in route ? modules.find((m) => m.id === route.moduleId) : undefined;
  const homeIndex = Math.max(0, mod ? modules.indexOf(mod) : 0);

  let screen: React.ReactNode;
  if (route.name === 'home' || !mod) {
    screen = (
      <Home
        modules={modules}
        progress={progress}
        initialIndex={homeIndex}
        onOpen={(moduleId) => setRoute({ name: 'module', moduleId })}
      />
    );
  } else if (route.name === 'module') {
    screen = (
      <ModuleMenu
        module={mod}
        progress={progress}
        onAction={(a) => {
          if (a.kind === 'back') setRoute({ name: 'home' });
          else if (a.kind === 'learn') setRoute({ name: 'learn', moduleId: mod.id, start: a.start });
          else if (a.kind === 'quiz') setRoute({ name: 'quiz', moduleId: mod.id, quizId: a.quizId });
          else setRoute({ name: 'examples', moduleId: mod.id });
        }}
      />
    );
  } else if (route.name === 'learn') {
    screen = (
      <Learn
        module={mod}
        start={route.start}
        completed={moduleProgress(progress, mod.id).completedChunks}
        onChunkDone={(chunkId, index) =>
          update(mod.id, (mp) => ({
            ...mp,
            lastChunk: index,
            completedChunks: mp.completedChunks.includes(chunkId)
              ? mp.completedChunks
              : [...mp.completedChunks, chunkId],
          }))
        }
        onCheck={(questionId, correct) =>
          update(mod.id, (mp) => ({ ...mp, checks: [...mp.checks, { date: today(), questionId, correct }] }))
        }
        onExit={() => setRoute({ name: 'module', moduleId: mod.id })}
        onQuiz={() =>
          mod.quizzes[0] && setRoute({ name: 'quiz', moduleId: mod.id, quizId: mod.quizzes[0].id })
        }
      />
    );
  } else if (route.name === 'quiz') {
    const quiz = mod.quizzes.find((q) => q.id === route.quizId);
    screen = quiz ? (
      <QuizScreen
        key={quiz.id}
        module={mod}
        quiz={quiz}
        onFinish={(attempt, row) => {
          update(mod.id, (mp) => ({ ...mp, quizAttempts: [...mp.quizAttempts, attempt] }));
          onProgressRow?.(row);
        }}
        onExit={() => setRoute({ name: 'module', moduleId: mod.id })}
      />
    ) : (
      <Frame keys={[]}>
        <Text color="red">Quiz not found.</Text>
      </Frame>
    );
  } else {
    screen = (
      <Frame crumb={[mod.title, 'Worked examples']} keys={exampleKeys}>
        <ExampleViewer
          examples={mod.examples}
          width={columns - 2}
          height={rows - CHROME_LINES}
          onClose={() => setRoute({ name: 'module', moduleId: mod.id })}
        />
      </Frame>
    );
  }

  return (
    <>
      {saveError ? <Text color="red">{saveError}</Text> : null}
      {screen}
    </>
  );
}
