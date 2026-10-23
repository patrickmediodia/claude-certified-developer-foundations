import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Example } from '../content/types.js';
import { renderMarkdown } from '../ui/markdown.js';
import { ScrollView } from '../ui/ScrollView.js';

export const exampleKeys: [string, string][] = [
  ['n/p', 'next/prev example'],
  ['↑↓', 'scroll'],
  ['b/Esc', 'back'],
];

/** Shows one worked example at a time; `n`/`p` cycle through `examples` (already ordered). */
export function ExampleViewer(props: {
  examples: Example[];
  width: number;
  height: number;
  startIndex?: number;
  label?: string;
  onClose: () => void;
}) {
  const [i, setI] = useState(props.startIndex ?? 0);
  const n = props.examples.length;
  useInput((input, key) => {
    if (key.escape || input === 'b' || key.leftArrow) props.onClose();
    else if (input === 'n' || key.tab || key.rightArrow) setI((x) => (x + 1) % n);
    else if (input === 'p') setI((x) => (x - 1 + n) % n);
  });
  const ex = props.examples[i];
  if (!ex) return <Text color="yellow">No worked examples for this module yet.</Text>;
  return (
    <Box flexDirection="column">
      <Text>
        <Text bold color="magentaBright">
          Example {ex.number}. {ex.title}
        </Text>
        <Text dimColor>
          {'  '}({i + 1}/{n}
          {props.label ? `, ${props.label}` : ''})
        </Text>
      </Text>
      <ScrollView text={renderMarkdown(ex.markdown, props.width)} height={props.height - 1} resetKey={i} />
    </Box>
  );
}
