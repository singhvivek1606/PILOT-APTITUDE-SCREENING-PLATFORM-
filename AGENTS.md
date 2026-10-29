# AGENTS.md — AeroVector Pilot Aptitude Screening Platform

Context for AI coding agents (Claude Code, Codex, Cursor, etc.). Read this before making changes.

## What this project is

**AeroVector** is a desktop pilot aptitude screening app built for the *Aviation Pilot Aptitude Hackathon Brief v2.0*. Candidates register, then take six keyboard-driven aptitude tests (inspired by COMPASS-style pilot screening) in either **Practice** or **Scored Assessment** mode. Scored results are saved locally and shown in Results/History.

- Stack: **Electron** shell + **plain HTML / CSS / vanilla JavaScript** frontend. No framework, no bundler, no build step for the UI, no backend.
- Targets: **Windows (required hackathon deliverable: native installer/exe)** and macOS (extra convenience).
- Current version: `2.3.0` (see `package.json`).
- It is a **hackathon/training prototype**, not an official selection system. The 60% PASS rule is a demo rule. Keep that disclaimer wherever scores are presented.

## Commands

```bash
npm install                 # first time (never copy node_modules between OSes)
npm start                   # run the Electron app (same as npm run dev)

# Checks
npm run lint                # ESLint (eslint.config.mjs, flat config, recommended rules)
npm run check:syntax        # node --check on electron/main.cjs + js/*.js (scripts/check-syntax.mjs)
npm test                    # node:test smoke tests
npm run build               # electron-builder --dir: unpacked app for current OS in dist/ (quick packaging check)
npm run verify              # all of the above in order

# Packaging (output in dist/, unsigned)
npm run dist:win            # Windows NSIS installer (run on Windows)
npm run dist:win:portable   # Windows portable exe
npm run dist:mac            # macOS dmg + zip for current arch (run on a Mac)
npm run dist:mac:arm64 | dist:mac:x64 | dist:mac:universal
```

**Git hooks (Husky):** `npm install` runs `prepare` → `husky`, which enables `.husky/pre-commit`. Every commit runs lint → syntax check → smoke tests → build, and is aborted if any step fails. CI (`.github/workflows/validate.yml`) runs lint, syntax and tests. Don't bypass the hook with `--no-verify` unless the user asks.

Double-click helpers: `RUN_ELECTRON.cmd` / `BUILD_WINDOWS_INSTALLER.cmd` (Windows), `RUN_ELECTRON_MAC.command` / `BUILD_MAC_APP.command` (macOS).

## Architecture

```
index.html            App shell: header/nav, <main id="app">, toast; loads js/*.js with defer in order
css/main.css          App chrome + pages (header, home, register, results, history, controls), built on the theme tokens
css/instrument.css    Design system: dark/light theme palette (--ins-*), test components, briefing/results, previews, module adapters
js/core.js            window.AVCore   — constants (MODULES, DEFAULT_KEYS, STORAGE_KEYS), shared `state`, `app` hooks, read/write storage, validKeys
js/ui.js              window.AVUI     — pure helpers (escapeHtml, clamp, rand, fmtTime), SVG builders (gauges, previews, planeSvg, scoreChart), toast
js/screens.js         window.AVScreens — non-test pages as HTML strings: home/welcome, register, tests, results, history, settings, complete
js/assessment.js      window.AVAssess — per-module views, update/draw logic, grading for the six tests
js/app.js             Entry point (IIFE): hash router, render(), session lifecycle (startSession/stop/finish), requestAnimationFrame tick loop, keyboard/click/submit event delegation, theme, export, question factories, registration form
electron/main.cjs     Electron main process: secure BrowserWindow, loads index.html via loadFile, blocks navigation/new windows/permissions
assets/               aerovector.ico (Windows), .icns (macOS), .png (Dock/UI)
tests/smoke.test.mjs  node:test smoke tests; loads browser modules in a vm context with a fake window/localStorage
```

### Key conventions

- **No ES modules in the renderer.** Each `js/*.js` file is an IIFE that attaches one global (`window.AVCore`, `AVUI`, `AVScreens`, `AVAssess`). Load order in `index.html` matters: `core → ui → screens → assessment → app`. The app must keep working when `index.html` is opened directly via `file://`.
- **Rendering is string templates.** Screens/views return HTML strings; `app.js` `render()` sets `#app` innerHTML. **Always pass user-supplied text through `escapeHtml`.**
- **Shared mutable state** lives in `AVCore.state` (`page`, `candidate`, `history`, `keys`, `selection`, `session`, `capture`, `theme`). Other modules mutate it and call `app.refresh()` / `app.finish()` / `app.restartLoop()` (wired up in `app.js`).
- **Events are delegated** in `app.js` (`click`, `submit`, `change`, `keydown`/`keyup`), dispatched on `data-*` attributes. Add new interactions there and don't attach listeners inside rendered HTML.
- **Persistence:** `localStorage` keys `aerovector.candidate`, `aerovector.history` (max 300 records, newest first), `aerovector.keys`, `aerovector.theme`. Always go through `AVCore.read/write`, which falls back to an in-memory store if storage is unavailable.
- **Only scored assessments are saved to History.** Practice runs never are. A scored assessment needs a registered candidate.
- **Scores** are clamped to 0–100 in `finish()`. PASS = score ≥ 60, otherwise NEEDS PRACTICE.
- **Electron security** must stay strict: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, no external navigation, permission requests denied. There is no preload/IPC, so don't add Node APIs to the renderer.
- Code style: 2-space indent, `"use strict"`, small functions, section banners (`// ====`). Match the surrounding file.

## Design system (`css/instrument.css`)

The theme palette for the **whole app** and everything a candidate sees inside a test — header, instrument panels, readouts, data entry, review, briefing and results — comes from `css/instrument.css`. `main.css` builds the app pages from the same tokens. The header comment in `instrument.css` lists every token and component; read it before styling anything.

- **Tokens:** `--ins-*` for colour, type, shape (`--ins-radius-xs/-sm/(base)/-lg` = 3/6/10/14px), control heights (`--ins-ctl-sm/-/-lg` = 32/40/48px), space and motion. Use them instead of raw values.
- **Aerospace palette:** navy-tinted neutrals, one aviation-blue brand colour (`--ins-primary` for text/lines/selection/focus, `--ins-primary-fill` + `--ins-on-primary` for filled buttons, `-soft`/`-line` for selected states), a navy "glareshield" header (`--ins-chrome*`) in both themes. Colour carries meaning: blue = action/active, green = correct/pass, red = wrong/warning, amber = caution/hazard/needs practice (each status has a `-soft` tint for chips). No glows or decorative gradients.
- **Shape + controls:** precise panel-like corners (no pill shapes), uppercase tracked button labels, blue status edge (3px top border) on test headers and results.
- **Themes:** dark is the default (`:root`), light overrides it (`:root[data-theme="light"]`); `applyTheme()` in `app.js` sets the attribute. Never hard-code a colour: CSS uses `var(--ins-*)`, SVG drawings in `ui.js` use the `.pv-*` / `.chart-*` classes, and canvas code reads the tokens through `palette()` in `assessment.js`.
- **Aviation cues (keep them quiet):** tracked uppercase labels, mono readouts, the faint chart graticule on the page, the UTC (Zulu) clock in the header, port red / starboard green, amber (`--ins-caution`) only for hazards and "needs practice".
- **Structure:** `renderAssessment()` wraps every test view in `.ins-test`. The header is `runHead()` (`.ins-head`); content goes in `.ins-panel` → `.ins-panel-head` / `.ins-strip` + `.ins-cell` / `.ins-line` / `.ins-foot`. Memory is the reference implementation.
- **Keyboard first:** show keys with `<kbd>`; no on-screen keypads.
- **Older modules:** Control, Maths, Slalom, Orientation and Task Manager still use their original markup, mapped onto the tokens by the "Module adapters" section. When you rebuild one on `.ins-*` components, delete its adapter rules.

## The six modules (`AVCore.MODULES`)

| id | Name | What it tests | Scored / Practice |
|----|------|---------------|-------------------|
| `memory` | Memory | Memorise 4 flight parameters, recall the hidden ones. Difficulty easy/medium/hard = 8 s/1 hidden, 6 s/2, 5 s/4 | 5 rounds / 2 |
| `control` | Control | Compensatory tracking: needle stage, **then** ball stage (sequential by design) | 60 s / 20 s |
| `maths` | Mathematics | Aviation arithmetic (speed, distance, time, fuel) | 8 q in 240 s / 3 q in 90 s |
| `slalom` | Slalom | Steer through accelerating gates with extra hazards | 3 × 90 s runs / 1 × 30 s |
| `orientation` | Orientation | Read RBI, artificial horizon and compass, pick the matching aircraft | 12 q in 600 s / 4 q in 120 s |
| `task` | Task Manager | Dual task: copy autopilot values while clearing alerts | 60 s / 30 s |

Session setup lives in `app.js` `startSession()`. Per-module logic and grading live in `assessment.js`. The default keys are arrow keys + Space (alert) and can be rebound under **Controls** (validated by `validKeys`: unique, arrows/Space/KeyA–Z).

**Intentional design deviation:** the brief's Control reference tracks the needle and ball at the same time. This build runs them in separate stages at the project owner's request. Don't "fix" this.

## When making changes

1. Keep it dependency-free in the renderer. Don't add frameworks, bundlers or CDNs. The app runs offline.
2. If you add or rename a module, update `MODULES` in `core.js`, `startSession()` in `app.js`, the view map in `assessment.js` `renderAssessment()`, the previews in `ui.js`/`screens.js`, and the smoke test, which asserts exactly six module ids.
3. If you add a new JS file, add it to `index.html` in dependency order. `package.json` `build.files` already includes `js/**/*`.
4. Run `npm run verify` (the same checks as the pre-commit hook) before you finish. For UI changes, also run `npm start` and check the change.
5. Keep `README.md` in sync when you change features, commands, or the folder structure.
6. Never commit `node_modules/` or `dist/`.
