import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { askCoach, buildFirstTurn, COACH_MODEL, type CoachTurn } from '../coach.js';
import type { Chunk } from '../content/types.js';
import { renderMarkdown } from '../ui/markdown.js';
import { ScrollView } from '../ui/ScrollView.js';

type Phase = 'input' | 'streaming' | 'answered' | 'error';

export const askKeys = (phase: Phase): [string, string][] =>
  phase === 'input'
    ? [['Enter', 'send (empty = "explain differently")'], ['Esc', 'back to lesson']]
    : phase === 'streaming'
      ? [['↑↓', 'scroll'], ['Esc', 'cancel']]
      : [['f', 'follow-up question'], ['↑↓', 'scroll'], ['b/Esc', 'back to lesson']];

/**
 * "Explain differently / I have a question": sends the current chunk plus the question to
 * Claude and streams the markdown answer. Follow-ups keep the side conversation.
 */
export function AskPanel(props: {
  chunk: Chunk;
  width: number;
  height: number;
  onClose: () => void;
  onPhase?: (p: Phase) => void;
}) {
  const [phase, setPhaseState] = useState<Phase>('input');
  const [draft, setDraft] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState<CoachTurn[]>([]);
  const [lastQuestion, setLastQuestion] = useState('');
  const abort = useRef<AbortController | undefined>(undefined);
  const buffer = useRef('');

  const setPhase = (p: Phase) => {
    setPhaseState(p);
    props.onPhase?.(p);
  };
  useEffect(() => () => abort.current?.abort(), []);

  const send = async (question: string) => {
    const q = question.trim() || "Explain this chunk differently — I didn't fully get it.";
    setLastQuestion(q);
    setPhase('streaming');
    setAnswer('');
    setError(undefined);
    buffer.current = '';
    const ctrl = new AbortController();
    abort.current = ctrl;
    // Throttle re-renders while streaming: flush the buffer at most every 80ms.
    const timer = setInterval(() => setAnswer(buffer.current), 80);
    const result = await askCoach({
      breadcrumb: props.chunk.breadcrumb,
      chunkMarkdown: props.chunk.markdown,
      history,
      question: q,
      onText: (d) => (buffer.current += d),
      signal: ctrl.signal,
    });
    clearInterval(timer);
    if (ctrl.signal.aborted && !result.ok) {
      setAnswer(buffer.current);
      setError('Cancelled.');
      setPhase('error');
      return;
    }
    if (result.ok) {
      setAnswer(result.text);
      const userTurn = history.length ? q : buildFirstTurn(props.chunk.breadcrumb, props.chunk.markdown, q);
      setHistory([...history, { role: 'user', content: userTurn }, { role: 'assistant', content: result.text }]);
      setPhase('answered');
    } else {
      setAnswer(result.partial);
      setError(result.message);
      setPhase('error');
    }
  };

  useInput(
    (input, key) => {
      if (phase === 'input') {
        if (key.escape) props.onClose();
        return;
      }
      if (phase === 'streaming') {
        if (key.escape) abort.current?.abort();
        return;
      }
      if (input === 'f') {
        setDraft('');
        setPhase('input');
      } else if (key.escape || input === 'b' || key.leftArrow) props.onClose();
    },
  );

  const header = (
    <Text>
      <Text bold color="magentaBright">Ask Claude</Text>
      <Text dimColor> ({COACH_MODEL}) about: {props.chunk.breadcrumb.slice(1).join(' › ')}</Text>
    </Text>
  );

  if (phase === 'input') {
    return (
      <Box flexDirection="column">
        {header}
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            {history.length
              ? 'Follow-up question:'
              : 'Type a question, or press Enter on an empty line to get this chunk explained differently.'}
          </Text>
          <Box>
            <Text color="cyan">› </Text>
            <TextInput value={draft} onChange={setDraft} onSubmit={(v) => void send(v)} />
          </Box>
        </Box>
      </Box>
    );
  }

  const body =
    `**You:** ${lastQuestion}\n\n` + (answer ? answer : phase === 'streaming' ? '' : '_No answer._');
  return (
    <Box flexDirection="column">
      {header}
      {phase === 'streaming' ? (
        <Text color="yellow">
          <Spinner type="dots" /> thinking / streaming… (Esc to cancel)
        </Text>
      ) : error ? (
        <Text color="red" wrap="wrap">
          {error}
        </Text>
      ) : (
        <Text dimColor>Answer complete.</Text>
      )}
      <ScrollView
        text={renderMarkdown(body, props.width)}
        height={props.height - 2}
        follow={phase === 'streaming'}
        resetKey={lastQuestion}
      />
    </Box>
  );
}
