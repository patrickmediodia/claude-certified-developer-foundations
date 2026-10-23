/**
 * Prints what tutui parses from the repo content (no TTY needed).
 * Usage: npm run parse            (exit code 1 if any module reports parse errors)
 */
import { loadModules, repoRoot } from '../src/content/modules.js';

const modules = loadModules();
console.log(`Repo root: ${repoRoot()}\nModules: ${modules.length}\n`);
let problems = 0;
for (const m of modules) {
  console.log(`=== ${m.id}: ${m.title}`);
  if (m.domainLine) console.log(`    domain line: ${m.domainLine}`);
  if (m.domains.length)
    console.log(`    domains: ${m.domains.map((d) => `${d.name} ${d.weight}`).join('; ')}`);
  console.log(`    chunks: ${m.chunks.length}, examples: ${m.examples.length}, quizzes: ${m.quizzes.length}`);
  for (const c of m.chunks) {
    const p = c.part ? ` (${c.part.n}/${c.part.of})` : '';
    console.log(`      [${c.index}] ${c.breadcrumb.slice(1).join(' › ')}${p}  — ${c.markdown.split('\n').length} src lines`);
  }
  for (const e of m.examples) console.log(`      example ${e.number}. ${e.title}`);
  for (const q of m.quizzes) {
    console.log(`    quiz "${q.title}" (${q.questions.length} questions)`);
    for (const x of q.questions) {
      console.log(`      ${x.label} → ${x.answer.join(', ')} | ${x.stem.slice(0, 70).replace(/\n/g, ' ')}…`);
      console.log(`         options: ${x.options.map((o) => o.letter).join('')}; rationale: ${x.rationale.length} chars`);
    }
  }
  for (const e of m.errors) {
    problems++;
    console.log(`    ! ${e}`);
  }
  console.log();
}
process.exitCode = problems ? 1 : 0;
