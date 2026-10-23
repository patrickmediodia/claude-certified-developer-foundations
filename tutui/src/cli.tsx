#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { loadModules, repoRoot } from './content/modules.js';
import { loadProgress } from './progress.js';

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('tutui needs an interactive terminal (TTY). Try `npm run parse` to check content parsing.');
  process.exit(1);
}

const modules = loadModules();
if (modules.length === 0) {
  console.error(`tutui: no module folders (0*-*/) found under ${repoRoot()}. Set TUTUI_ROOT to the repo root.`);
  process.exit(1);
}

const rows: string[] = [];
const app = render(
  <App modules={modules} initialProgress={loadProgress()} onProgressRow={(r) => rows.push(r)} />,
  { alternateScreen: true },
);
await app.waitUntilExit();
if (rows.length) {
  console.log('Quiz results from this session. Paste into PROGRESS.md → "Quiz history":\n');
  for (const r of rows) console.log(r);
}
