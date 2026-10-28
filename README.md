# AeroVector — Pilot Aptitude Screening Platform

Independent aviation-inspired aptitude screening prototype, built entirely with **HTML, CSS, vanilla JavaScript, and SVG**.

> **Independent educational prototype.** AeroVector is not COMPASS™ software, is not affiliated with EPST, and is not a scientifically validated or certified tool for real-world pilot selection.

## Phase 1: Frontend design review

This branch is a **frontend-first visual redesign**. The interface is intentionally separated from the existing assessment engine so the screens can be reviewed before assessment functionality is integrated.

The frontend includes:
- **Two distinct visual themes:** Light (balanced gray cockpit workspace, default) and Dark (muted instrument-panel palette). A persistent accessible two-button switch in the header stores the selection in `aerovector.v1.theme`.
- **Cockpit-inspired Memory preview:** fixed SVG Primary Flight Display and Navigation Display, plus the four required flight readings; values are examples, not an active test.
- Responsive navigation for Overview, Assessments, Practice studio, Results & analytics, History, Memory recall, and Control tracking.
- Professional, custom SVG aviation instrument displays (static previews).
- Interactive module selection, mode selection, Memory difficulty selection, and candidate display-name settings.
- Empty states for users without results, plus a **manually enabled and clearly labeled demonstration-data mode**.
- Read-only compatibility with existing local browser results stored under `aerovector.v1.history`.
- JSON export for *real* saved local results only, never for demonstration records.
- Keyboard-accessible dialog controls and mobile navigation.

**Important:** This phase does not run the Memory/Control exams or generate scores. The **View session status** action explains that live test execution is not yet connected. The original `app.js` and original scoring tests are preserved. `core.mjs` receives only two zero-duration/empty-trial scoring guards to fix pre-existing test failures; normal scoring remains unchanged.

## Run locally

No packages, build tools, database, API keys or external services are required.

```bash
python -m http.server 8000
```

Then open **http://localhost:8000** in a browser. Alternatively, use any static HTTP server.

## Tests

With Node.js installed:

```bash
node --check frontend.js
node --test tests/*.test.mjs
```

The repository CI validates the previous scoring engine and the new frontend's page-rendering behavior.

## File map

| File | Purpose |
| --- | --- |
| `index.html` | Phase 1 application shell and navigation |
| `styles.css` | Base responsive layout and visual components |
| `themes.css` | Light and dark themes, navigation styling, and cockpit instrument preview |

| `frontend.js` | Phase 1 pages, views and user interface behaviors |
| `app.js` | Preserved original Memory/Control implementation, not currently loaded |
| `core.mjs` | Preserved pure assessment logic and scoring |
| `tests/frontend.test.mjs` | Frontend rendering and demonstration-data validation |
| `tests/core.test.mjs` | Original scoring tests |

## Next stages (after visual approval)

1. Integrate real Memory practice and assessment sessions.
2. Integrate real Control practice, animation physics and scoring.
3. Connect the verified scored results to the redesigned dashboard and history.
4. Complete usability, accessibility, responsive and end-to-end browser validation.

LocalStorage is not a secure examination or proctoring backend. Any future attempt limits stored only in a browser are not enforceable.

## Precise scope and behavior

- **Theme switch:** Light and Dark buttons change the entire workspace immediately, use `aria-pressed` to communicate selection, and persist via LocalStorage. If storage is disabled, switching still works until reload. The instruments deliberately keep their own dark palette in both modes.
- **Navigation:** The top navigation and mobile drawer switch views without a page reload; browser Back and Forward are supported using URL fragments.
- **Memory configuration:** Practice/Assessment and Easy/Medium/Hard controls change visible settings, including the 8/6/5-second *display label*. This is a visual preview: no active timer runs. The preview values 12,500 ft, 245 KTS, 274° and 121.50 MHz are fixed examples.
- **Control preview:** Displays a static compensatory tracking gauge. It does not drift or score until Phase 3.
- **Result displays:** Read legacy LocalStorage data under `aerovector.v1.history`; sample records must be explicitly enabled and never replace true records. Export only exports actual saved records.
- **Candidate preferences:** The displayed candidate name can be changed and is stored under `aerovector.preview.candidate`.
- **Not yet implemented:** Memory round timers/recall/scoring, Control physics/keyboard handling and scored test recording. The original implementation exists separately in `app.js`, but is not connected to the approved visual shell; integration is a subsequent phase.
