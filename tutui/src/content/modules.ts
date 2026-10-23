import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExamples } from './examples.js';
import { parseNotes } from './lessons.js';
import { parseQuiz } from './quiz.js';
import type { DomainInfo, Module } from './types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root: `TUTUI_ROOT` env, else two levels above this file (`tutui/src|dist/content` → repo). */
export function repoRoot(): string {
  return process.env.TUTUI_ROOT
    ? path.resolve(process.env.TUTUI_ROOT)
    : path.resolve(here, '..', '..', '..');
}

const readIfExists = (p: string): string | undefined => {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return undefined;
  }
};

const words = (s: string) =>
  new Set(s.toLowerCase().match(/[a-z]{3,}/g)?.filter((w) => !['and', 'the'].includes(w)) ?? []);

interface Catalog {
  /** Lesson name → exam domains mapped to it (from the CLAUDE.md weights table). */
  domains: Map<string, DomainInfo[]>;
  /** Lesson names in course order (from the CLAUDE.md "Course lessons" list). */
  lessons: string[];
}

/** Read exam-domain weights and lesson names from the root CLAUDE.md (best effort; read-only). */
export function readCatalog(root: string): Catalog {
  const md = readIfExists(path.join(root, 'CLAUDE.md')) ?? '';
  const domains = new Map<string, DomainInfo[]>();
  for (const line of md.split('\n')) {
    // | 1 | Applications & Integration | 33.1% | Production-Grade Prompting, Agents & Tool Use |
    const m = /^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([\d.]+%)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (!m) continue;
    const lesson = m[3]!;
    domains.set(lesson, [...(domains.get(lesson) ?? []), { name: m[1]!, weight: m[2]! }]);
  }
  const lessons = [...md.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)].map((m) => m[1]!);
  return { domains, lessons };
}

function bestMatch(candidates: string[], folder: string): string | undefined {
  const fw = words(folder.replace(/^\d+-/, '').replace(/-/g, ' '));
  let best: { c: string; s: number } | undefined;
  for (const c of candidates) {
    const cw = words(c);
    const s = [...fw].filter((w) => cw.has(w)).length;
    if (s > 0 && (!best || s > best.s)) best = { c, s };
  }
  return best?.c;
}

const titleCase = (slug: string) =>
  slug
    .replace(/^\d+-/, '')
    .split('-')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');

/** Load one module folder. Never throws: problems end up in `module.errors`. */
export function loadModule(dir: string, catalog: Catalog): Module {
  const id = path.basename(dir);
  const number = Number(/^(\d+)/.exec(id)?.[1] ?? 0);
  const lessonName = bestMatch(catalog.lessons, id) ?? bestMatch([...catalog.domains.keys()], id);
  const fallbackTitle = `Module ${number} — ${lessonName ?? titleCase(id)}`;
  const errors: string[] = [];
  const mod: Module = {
    id,
    dir,
    number,
    title: fallbackTitle,
    domains: [],
    chunks: [],
    examples: [],
    quizzes: [],
    errors,
    hasNotes: false,
  };
  const domainKey = bestMatch([...catalog.domains.keys()], lessonName ?? id);
  if (domainKey) mod.domains = catalog.domains.get(domainKey) ?? [];

  const guard = (file: string, fn: (text: string) => void) => {
    const text = readIfExists(path.join(dir, file));
    if (text === undefined) return;
    try {
      fn(text);
    } catch (err) {
      errors.push(`${file}: failed to parse (${(err as Error).message}).`);
    }
  };

  guard('NOTES.md', (text) => {
    const r = parseNotes(text, fallbackTitle);
    mod.hasNotes = true;
    mod.title = r.value.title;
    mod.domainLine = r.value.domainLine;
    mod.chunks = r.value.chunks;
    errors.push(...r.errors);
  });
  guard('EXAMPLES.md', (text) => {
    const r = parseExamples(text);
    mod.examples = r.value;
    errors.push(...r.errors);
  });
  guard('QUIZ.md', (text) => {
    const r = parseQuiz(text, id);
    mod.quizzes = r.value;
    errors.push(...r.errors.map((e) => (e.startsWith('QUIZ.md') ? e : `QUIZ.md: ${e}`)));
  });
  return mod;
}

/** Discover and load every `0*-*` module folder under the repo root, sorted by name. */
export function loadModules(root = repoRoot()): Module[] {
  const catalog = readCatalog(root);
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }
  return entries
    .filter((n) => /^0\d*-.+/.test(n) && fs.statSync(path.join(root, n)).isDirectory())
    .sort()
    .map((n) => loadModule(path.join(root, n), catalog));
}
