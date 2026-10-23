import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface QuizAttempt {
  date: string; // YYYY-MM-DD (local)
  quizId: string;
  quizTitle: string;
  score: number;
  total: number;
  missed: string[]; // question ids
}

export interface CheckResult {
  date: string;
  questionId: string;
  correct: boolean;
}

export interface ModuleProgress {
  completedChunks: string[];
  lastChunk?: number;
  quizAttempts: QuizAttempt[];
  checks: CheckResult[];
}

export interface Progress {
  version: 1;
  modules: Record<string, ModuleProgress>;
}

const here = path.dirname(fileURLToPath(import.meta.url));

/** `tutui/.progress.json` (this file lives in `tutui/src` or `tutui/dist`). Override with TUTUI_PROGRESS. */
export const progressPath = () =>
  process.env.TUTUI_PROGRESS ?? path.resolve(here, '..', '.progress.json');

export const emptyProgress = (): Progress => ({ version: 1, modules: {} });

export function loadProgress(file = progressPath()): Progress {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Progress>;
    if (data && typeof data.modules === 'object' && data.modules) {
      return { version: 1, modules: data.modules as Progress['modules'] };
    }
  } catch {
    // Missing or corrupt file: start fresh (the corrupt file is overwritten on next save).
  }
  return emptyProgress();
}

export function saveProgress(p: Progress, file = progressPath()): string | undefined {
  try {
    fs.writeFileSync(file, JSON.stringify(p, null, 2) + '\n');
    return undefined;
  } catch (err) {
    return `Could not save progress to ${file}: ${(err as Error).message}`;
  }
}

export function moduleProgress(p: Progress, moduleId: string): ModuleProgress {
  const m = p.modules[moduleId];
  return {
    completedChunks: m?.completedChunks ?? [],
    lastChunk: m?.lastChunk,
    quizAttempts: m?.quizAttempts ?? [],
    checks: m?.checks ?? [],
  };
}

/** Pure update helper: returns a new Progress with `fn` applied to one module. */
export function updateModule(
  p: Progress,
  moduleId: string,
  fn: (m: ModuleProgress) => ModuleProgress,
): Progress {
  return { ...p, modules: { ...p.modules, [moduleId]: fn(moduleProgress(p, moduleId)) } };
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** A row for the PROGRESS.md "Quiz history" table: `| Date | Topic | Score | Weak spots |`. */
export function progressRow(opts: {
  date: string;
  topic: string;
  score: number;
  total: number;
  weakSpots: string[];
}): string {
  const pct = opts.total ? Math.round((opts.score / opts.total) * 100) : 0;
  const weak = opts.weakSpots.length ? opts.weakSpots.join('; ') : 'none';
  const esc = (s: string) => s.replace(/\|/g, '\\|');
  return `| ${opts.date} | ${esc(opts.topic)} | ${opts.score}/${opts.total} (${pct}%) | ${esc(weak)} |`;
}
