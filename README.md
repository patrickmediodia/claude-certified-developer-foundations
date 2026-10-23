# Claude Certified Developer – Foundations (CCDV-F) study repo

A personal study workspace for passing the **CCDV-F** exam: 53 items in 120 minutes, pass mark 720/1000.
Claude acts as teacher and exam coach. It teaches one topic at a time, checks that you've understood it, quizzes you
with exam-style scenario questions, and tracks your progress. The material follows the official
[prep course](https://anthropic-partners.skilljar.com/path/claude-certified-developer-foundations)
and the [exam guide](references/ccdv-f-exam-guide.pdf).

| Path | What it is |
|---|---|
| `CLAUDE.md` | Coach role, teaching loop, exam facts, official domain & skill weights |
| `PROGRESS.md` | Per-topic status and quiz history (the source of truth) |
| `0N-<module>/` | One folder per course module: `NOTES.md`, `EXAMPLES.md`, `QUIZ.md` |
| `references/` | Official exam guide PDFs, docs snapshots, and `SOURCES.md` (every link we rely on) |
| `PROJECT_INSTRUCTIONS.md` | Paste-ready instructions for the claude.ai Project |
| `tutui/` | **tutui**, the terminal tutor app (see `tutui/README.md`) |

## How to use it

Each study session goes like this:

1. **Start a session** in Claude Code from the repo root (`claude`). The coach first checks the
   official sources in `references/SOURCES.md` to see whether the syllabus, weights or exam facts have changed.
2. **Pick a focus**: one lesson or sub-topic, chosen by you or recommended by exam weight.
3. **Learn**: the coach explains it with examples until you both agree you've got it.
4. **Quiz**: answer exam-style multiple-choice and multiple-response questions, then go through why each wrong option is wrong.
5. **Review & track**: the coach updates `PROGRESS.md`, then commits and pushes.

**Studying on the web / desktop app too?** The claude.ai Project reads this repo through the GitHub connector:
- After pushing, re-sync the connector so the web side sees the latest progress.
- The web side can't write to git. It outputs an updated `PROGRESS.md` block; paste that into Claude Code to commit it.

**Studying offline / solo?** Use **tutui** to work through the notes in short chunks and take the
module quizzes in the terminal. It gives you a row to paste into `PROGRESS.md`.

## Install

Prerequisites: [Claude Code](https://code.claude.com/docs/en/overview), git, and Node.js 20+ (for tutui).

```bash
git clone git@github.com:patrickmediodia/claude-certified-developer-foundations.git
cd claude-certified-developer-foundations
claude                       # start a coaching session
```

tutui:

```bash
cd tutui
npm install
npm start
```

tutui's "ask a question" feature is optional. It needs Claude API credentials: either
`export ANTHROPIC_API_KEY=...` or `ant auth login`. Everything else works without them.

claude.ai Project (optional): connect this repo with the GitHub connector, then paste the fenced
block from `PROJECT_INSTRUCTIONS.md` into the Project's custom instructions.
