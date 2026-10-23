# tutui: a terminal tutor for the CCDV-F exam

**tutui** (tutor + TUI) is an interactive terminal study coach for the
**Claude Certified Developer – Foundations (CCDV-F)** exam. It runs the same teaching
loop that `CLAUDE.md` defines for the study coach, without needing a chat session:

1. **Teach** one bite-sized chunk of a lesson.
2. **Confirm shared understanding.** You mark each chunk "got it", ask for a different
   explanation, or ask a question.
3. **Quiz** with scenario-based, exam-style multiple-choice questions, then explain each answer.
4. **Review & track.** You get a score, the questions you missed, and a row ready to paste
   into `PROGRESS.md`.

The app reads all of its content from the repo's module folders (`0*-*/`), so the notes
stay the single source of truth. New modules show up automatically once their
`NOTES.md` / `EXAMPLES.md` / `QUIZ.md` files exist.

It is built with TypeScript and [Ink](https://github.com/vadimdemedes/ink) (React for the
terminal, the same approach Claude Code uses).

---

## Install & run

Requires **Node.js 22+** (Ink 8's minimum).

```bash
cd tutui
npm install        # also compiles to dist/ via the "prepare" script
npm start          # runs from source with tsx
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: parser tests against the real `01-mso-foundations/` files, plus Ink render tests |
| `npm run parse` | Print what tutui parsed (chunks, examples, questions, answers, errors). No TTY needed. Exits 1 if any module has parse errors. |

tutui needs an interactive terminal (TTY). It runs in the alternate screen buffer, like
`less` or `vim`, so your scrollback is restored when you quit.

### Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` | Credentials for the optional Ask Claude feature. An `ant auth login` profile also works. |
| `TUTUI_OFFLINE=1` | Turn off the Claude feature completely |
| `TUTUI_ROOT` | Repo root to read modules from (default: the folder above `tutui/`) |
| `TUTUI_PROGRESS` | Progress file path (default: `tutui/.progress.json`) |

---

## How it works

### Screens & the loop

```
Home (modules + progress + exam-domain weights)
 └─ Module menu
     ├─ Learn ──► chunk ──► chunk ──► chunk ──► understanding check ──► chunk … ──► "Lesson complete → take the quiz"
     │             │  e: Ask Claude (explain differently / your question)
     │             │  x: show the most relevant worked example
     ├─ Quiz ───► one question per screen ──► verdict + correct answer + rationale ──► … ──► results summary
     └─ Worked examples
```

- **Learn mode** shows one chunk at a time, with its breadcrumb (module › part › section)
  in the header. After every 3 "got it"s (and at the end of the lesson) you get a
  **1-question understanding check**. tutui picks the module quiz question that best matches
  what you just read, using term overlap with extra weight on `code` terms. If no question
  matches well enough, you get a "ready to continue?" checkpoint instead. Each question
  is used for a check at most once per session.
- **Quiz mode** shows one question per screen. After you submit, it shows ✓/✗, the correct
  answer, and the answer-key rationale ("why the other options are wrong"). The results
  screen shows the score, a rough 72% pass-mark guide (the real exam is scaled to 720/1000),
  the missed questions, and the `PROGRESS.md` row. From there you can retake the whole quiz
  or retry only the questions you missed.
- **Multiple-response questions** are supported. When the answer key lists more than one
  letter (`**Q3 → A, C.**`), the question shows "(Select two.)", and you must pick exactly
  that many. Grading is exact-set.

### How lessons are chunked

`NOTES.md` is split by heading: `#` is the module title, `##` is a *part*, and `###` is a
*section*. Text before the first `##` becomes an "Overview" chunk. A section longer than
about **15 rendered lines**, or one with **more than one table**, is split further at
paragraph or bullet-item boundaries. The splitter never breaks inside a table or a code
fence, and never splits an ordered list (that would restart its numbering). A lead-in
paragraph that ends with `:` stays with the list or table it introduces. If a chunk is
still taller than the terminal, it scrolls (↑/↓).

Markdown is rendered with `marked` + `marked-terminal`. Tables are fitted to the terminal
width with word wrap, and lists are rendered by tutui itself (marked-terminal mangles
nested lists).

---

## Key bindings

The footer of every screen lists the keys that work there. Summary:

| Where | Keys |
|---|---|
| Everywhere | `Ctrl+C` quit |
| Home / module menu | `↑↓` (or `j/k`) move · `Enter` (or `1`–`9`) choose · `b`/`Esc` back · `q` quit (home) |
| Learn: chunk | `Enter`/`g`/`→` got it · `e`/`?` explain differently / ask · `x` show example · `b`/`←` previous chunk · `↑↓` `j/k` `u/d` scroll · `Esc` module menu |
| Learn: checkpoint | `Enter`/`y` continue · `e` ask first · `b` reread chunk |
| Question (quiz or check) | `↑↓` move · `A`–`D` select (toggle on multi-response) · `Space` toggle · `Enter` submit, then `Enter` continue · `PgUp/PgDn` scroll · `Esc` quit quiz / skip check |
| Quiz results | `r` retake · `m` retry missed only · `Enter`/`Esc` back |
| Examples | `n`/`p` next/previous · `↑↓` scroll · `b`/`Esc` back |
| Ask Claude | type, then `Enter` (empty = "explain differently") · `Esc` cancel the stream / go back · `f` follow-up |

---

## Ask Claude (optional)

In Learn mode, press `e` to ask about the current chunk. tutui sends the chunk plus your
question to **`claude-opus-5-5`** through the official `@anthropic-ai/sdk`, and streams the
answer into a markdown view. The system prompt casts Claude as a concise CCDV-F exam coach.
Press `f` to ask a follow-up in the same side conversation.

- **Credentials:** the zero-argument `new Anthropic()` client, which reads `ANTHROPIC_API_KEY`,
  `ANTHROPIC_AUTH_TOKEN`, or an `ant auth login` profile.
- **Request shape:** `messages.stream()` with `model`, `max_tokens`, `system` and `messages`
  only. It does not send `temperature`, `top_p`, `top_k`, or a thinking budget, because
  Opus 5.5 rejects them with a 400. Opus 5.5 always uses adaptive thinking at its default
  effort.
- **Works offline:** with no credentials, a network error, a rate limit (429), overload (529),
  or any other failure, tutui shows a one-line message and the rest of the app keeps working.
  Errors are classified with the SDK's typed error classes (`AuthenticationError`,
  `RateLimitError`, `APIConnectionError`, …).
- **Cost:** each question is a normal Opus 5.5 API call billed to your key. The chunk is
  usually a few hundred tokens.

---

## Progress

- Progress is saved to **`tutui/.progress.json`**, which is gitignored. It stores, per module:
  completed chunk ids, the last chunk, understanding-check results, and every quiz attempt
  (date, score, total, missed question ids).
- tutui **never writes to the repo's `PROGRESS.md`**. Instead, the quiz results screen shows
  a ready-to-paste row for the `PROGRESS.md` → *Quiz history* table:

  ```
  | 2026-10-23 | Module 1 — MSO Foundations · Quiz 1 | 5/6 (83%) | Q5 (A request to Opus 5.5…) |
  ```

  The row may wrap on screen, so tutui also prints every row from the session to the
  normal terminal when you quit. Copy it from there into `PROGRESS.md`, then follow the
  sync ritual in `CLAUDE.md` (commit and push from Claude Code).
- Chunk ids are built from the section headings (`<part-slug>/<section-slug>#<n>`). If you
  rename a heading, that section shows as not done again.

---

## Content format (what the parser expects)

To add a module, create a folder named `0N-some-slug/` at the repo root with any of the three
files below. No code changes are needed. Folders without content are listed as "no content
yet". The module title comes from the `#` heading in `NOTES.md`; if there isn't one, it comes
from the matching lesson in `CLAUDE.md`. Exam-domain weights come from the domain table in
`CLAUDE.md`. The `**Exam domain:**` line in `NOTES.md` is shown on the module screen.

### `NOTES.md`

```markdown
# Module 2 — Some Title
**Exam domain:** Something — 12.3% of the exam.

## Part 1 — Big idea          ← part
Intro text…

### A sub-topic               ← section (its own chunk, split further if long)
- bullets, | tables |, ```code```
```

### `EXAMPLES.md`

Each `## N. Title` heading starts one example (shown with `x` in Learn, ranked by
relevance to the current chunk, and listed under *Worked examples*).

### `QUIZ.md`

```markdown
## Quiz 1 (6 questions)

**Q1.** Scenario stem, which may
wrap over several lines.
- A. option
- B. option, which may continue
  on an indented line
- C. option
- D. option

**Q2.** Which TWO … ? (Select two.)
- A. …

<details>
<summary>Answers</summary>

- **Q1 → B.** Rationale, which can wrap over
  several indented lines.
- **Q2 → A, C.** Multiple-response: list every correct letter.
</details>
```

- The questions under a `##` heading form one quiz. Several quizzes per file are fine.
- An answer line can sit right after its quiz or in one key at the end. Each line attaches
  to the most recent quiz that has that question number unanswered. `→`, `->`, `=>` and `:`
  are all accepted as the arrow.
- Problems such as a missing answer, fewer than two options, or an answer letter that isn't
  an option are reported as **content problems** on the module screen and in
  `npm run parse`. The bad question is skipped and the app doesn't crash.

---

## Project structure

```
tutui/
├── package.json          # name/bin "tutui"; ESM; pinned dependency versions
├── tsconfig.json
├── src/
│   ├── cli.tsx           # entry: TTY check, load content + progress, render <App/>, print PROGRESS rows on exit
│   ├── app.tsx           # routing between screens; persists progress
│   ├── coach.ts          # Claude integration (streaming, typed error handling)
│   ├── progress.ts       # .progress.json load/save + PROGRESS.md row formatting
│   ├── content/
│   │   ├── modules.ts    # discover 0*-*/ folders, read CLAUDE.md domain table
│   │   ├── lessons.ts    # NOTES.md → chunks
│   │   ├── blocks.ts     # markdown block splitter + rendered-height estimate
│   │   ├── quiz.ts       # QUIZ.md → questions + answer key (single & multi-response)
│   │   ├── examples.ts   # EXAMPLES.md → examples
│   │   ├── relevance.ts  # pick check questions / rank examples by term overlap
│   │   └── types.ts
│   ├── screens/          # Home, ModuleMenu, Learn, QuizScreen, AskPanel, ExampleViewer
│   └── ui/               # Frame (header/footer), Menu, ScrollView, QuestionView, markdown renderer
├── scripts/parse-report.ts
└── test/                 # parse.test.ts (real repo content), app.test.tsx (ink-testing-library)
```

---

## Known limitations

- Chunk heights are estimated from the markdown source at 76 columns. On a very narrow or
  short terminal, a chunk can need scrolling.
- Understanding checks reuse questions from the module's own quiz, so you may see some quiz
  questions early. Keyword matching is heuristic: a check can be loosely related, or none
  may match (you then get the "ready to continue?" checkpoint).
- Ask Claude conversations are not saved. Leaving the panel discards them.
- `Esc` takes a moment to register in some terminals, because escape sequences have to be
  disambiguated.
- Progress uses heading-based ids, so renaming headings resets "done" for those sections.
- Only one terminal theme. Colours come from `chalk`/`marked-terminal` defaults.
