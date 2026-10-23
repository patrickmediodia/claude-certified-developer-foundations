import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Shows a window of pre-rendered (ANSI) lines. ↑/↓ or j/k scroll a line,
 * PgUp/PgDn (or u/d) scroll a page. With `follow`, it sticks to the bottom
 * while content grows (used for streamed answers).
 */
export function ScrollView(props: {
  text: string;
  height: number;
  active?: boolean;
  follow?: boolean;
  /** Reset to the top whenever this key changes (e.g. chunk id). */
  resetKey?: string | number;
  /** 'paging' = only PgUp/PgDn scroll (frees arrows and letters for the parent). */
  keys?: 'all' | 'paging';
}) {
  const all = props.keys !== 'paging';
  const lines = props.text.split('\n');
  const height = Math.max(3, props.height);
  const overflow = lines.length > height;
  const viewHeight = overflow ? height - 1 : height; // one line for the scroll hint
  const maxOffset = Math.max(0, lines.length - viewHeight);
  const [offset, setOffset] = useState(0);
  const [pinnedBottom, setPinnedBottom] = useState(!!props.follow);

  useEffect(() => {
    setOffset(0);
    setPinnedBottom(!!props.follow);
  }, [props.resetKey]);

  const effective = pinnedBottom && props.follow ? maxOffset : Math.min(offset, maxOffset);

  useInput(
    (input, key) => {
      const page = Math.max(1, viewHeight - 2);
      let next = effective;
      if (all && (key.downArrow || input === 'j')) next += 1;
      else if (all && (key.upArrow || input === 'k')) next -= 1;
      else if (key.pageDown || (all && input === 'd')) next += page;
      else if (key.pageUp || (all && input === 'u')) next -= page;
      else return;
      next = Math.max(0, Math.min(maxOffset, next));
      setOffset(next);
      setPinnedBottom(next >= maxOffset);
    },
    { isActive: props.active !== false },
  );

  const visible = lines.slice(effective, effective + viewHeight);
  return (
    <Box flexDirection="column" height={height}>
      {visible.map((l, i) => (
        <Text key={i} wrap="truncate-end">
          {l === '' ? ' ' : l}
        </Text>
      ))}
      {overflow ? (
        <Text dimColor>
          {effective < maxOffset
            ? `↓ more (${lines.length - effective - viewHeight} lines) — ${all ? '↑/↓ j/k scroll, u/d page' : 'PgUp/PgDn scroll'}`
            : `— end — ${all ? '↑/k' : 'PgUp'} to scroll back`}
        </Text>
      ) : null}
    </Box>
  );
}
