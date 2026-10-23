import React from 'react';
import { Box, Text, useWindowSize } from 'ink';

export type KeyHelp = [key: string, label: string][];

/** Terminal size with sane fallbacks (tests and some terminals report 0/undefined). */
export function useSize() {
  const { columns, rows } = useWindowSize();
  return { columns: columns || 100, rows: rows || 30 };
}

/** Lines used by the frame chrome (header 2 + footer 2 + status 1). */
export const CHROME_LINES = 5;

export function Frame(props: {
  crumb?: string[];
  keys: KeyHelp;
  status?: string;
  statusColor?: string;
  children: React.ReactNode;
}) {
  const { columns, rows } = useSize();
  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box paddingX={1}>
        <Box flexShrink={0}>
          <Text bold color="magentaBright">
            tutui
          </Text>
          <Text dimColor> · CCDV-F study coach  </Text>
        </Box>
        <Box flexShrink={1} flexGrow={1} overflow="hidden">
          <Text color="cyan" wrap="truncate-start">
            {props.crumb?.join(' › ') ?? ''}
          </Text>
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(Math.max(0, columns - 2))}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflow="hidden">
        {props.children}
      </Box>
      <Box paddingX={1}>
        <Text color={props.statusColor ?? 'yellow'} wrap="truncate-end">
          {props.status ?? ' '}
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(Math.max(0, columns - 2))}</Text>
      </Box>
      <Box paddingX={1}>
        <Text wrap="truncate-end">
          {props.keys.map(([k, label], i) => (
            <Text key={k + label}>
              {i > 0 ? <Text dimColor> · </Text> : null}
              <Text bold color="green">
                {k}
              </Text>
              <Text> {label}</Text>
            </Text>
          ))}
        </Text>
      </Box>
    </Box>
  );
}
