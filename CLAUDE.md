# CLAUDE.md

Claude Code loads this file automatically at the start of each session. The full project context is in AGENTS.md, which is shared with other AI agents, and is imported here:

@AGENTS.md

## Claude-specific notes

- Start each session by skimming `README.md` and the relevant `js/*.js` file before you edit. The files are large (`app.js` ~1000 lines, `assessment.js` ~1300, `main.css` ~1500, `instrument.css` ~1450), so read the section you need instead of the whole file.
- Verify with `npm run verify` (lint, syntax, tests, build), which is the same set of checks the Husky pre-commit hook runs. If a commit is rejected by the hook, fix the cause rather than using `--no-verify`. Use `npm start` to see UI changes in the real Electron window.
- Git: work on a branch for non-trivial changes, use conventional-style commit messages (e.g. `fix(ui): ...`, `refactor(ui): ...`), and only commit or push when asked.
- Windows packaging (`npm run dist:win`) must run on Windows. Don't try to produce the Windows installer from macOS.
