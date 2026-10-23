import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface MenuItem {
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** Vertical list; ↑/↓ (or j/k) move, Enter picks. Selection is controlled by the parent. */
export function Menu(props: {
  items: MenuItem[];
  index: number;
  onIndex: (i: number) => void;
  onSelect: (i: number) => void;
  active?: boolean;
}) {
  useInput(
    (input, key) => {
      const n = props.items.length;
      if (!n) return;
      if (key.upArrow || input === 'k') props.onIndex((props.index - 1 + n) % n);
      else if (key.downArrow || input === 'j') props.onIndex((props.index + 1) % n);
      else if (key.return) props.onSelect(props.index);
      else if (/^[1-9]$/.test(input) && Number(input) <= n) props.onSelect(Number(input) - 1);
    },
    { isActive: props.active !== false },
  );
  return (
    <Box flexDirection="column">
      {props.items.map((it, i) => {
        const on = i === props.index;
        return (
          <Box key={i}>
            <Text color={on ? 'cyan' : undefined}>{on ? '❯ ' : '  '}</Text>
            <Text color={on ? 'cyan' : undefined} bold={on} dimColor={it.disabled}>
              {it.label}
            </Text>
            {it.hint ? <Text dimColor>{'  '}{it.hint}</Text> : null}
          </Box>
        );
      })}
    </Box>
  );
}
