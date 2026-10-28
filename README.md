# AeroVector — Pilot Training Tests

A simple pilot-skills training website built with HTML, CSS, JavaScript and Canvas/SVG.

**Open it in your browser.** It works on Windows with Chrome, Firefox or Edge. You do not need Electron or npm packages just to use the website.

## Open in a browser (recommended)

1. Open PowerShell inside the project folder.
2. Run:

    python -m http.server 8000

3. Open **http://localhost:8000** in a browser.
4. Press Ctrl+C in PowerShell to stop the server.

**Alternative with Node.js:** run `npm.cmd start` on Windows. This starts a small local website at http://127.0.0.1:8000 and opens your default browser automatically. No `npm install` is required to run the browser version.

The site runs locally on your machine. It is **not yet hosted at a public internet address**.

## What's inside

- **Light and Dark themes** — change themes from the top bar.
- **Your details** — fill in your name, institute and contact details before a scored test.
- **Memory** — remember flight readings and fill in the missing numbers.
- **Control Tracking** — keep a moving **blue ball inside the red circle** by holding the **arrow keys or W, A, S, D**. A single ball and clear red target replace the confusing two-part control display. Practice lasts 20 seconds; scored tests last 60 seconds.
- **Maths** — answer flight-related number questions.
- **Slalom** — move a small aircraft left and right through the gaps.
- **Orientation** — choose the aircraft direction matching the readings.
- **Task Manager** — copy flight values and respond to alerts.
- **Keyboard controls** — change the keys in Settings.
- **Results** — scored results are saved only in the local browser. Practice results are not recorded.

## How to play Control Tracking

1. Choose **Control the ball** (Control Tracking).
2. Select **Practice**, then click **Start practice**.
3. Watch the blue ball. It slowly drifts away from the center.
4. Hold **← / A**, **→ / D**, **↑ / W** or **↓ / S** to move it back.
5. Keep the blue ball **inside the red center circle** for as much time as possible. The right-hand panel shows your progress.

A higher percentage of time in the red circle means a higher score. Change keys under **Keyboard controls** if needed.

## Optional Windows desktop application

The updated v2 brief also calls for a Windows executable. Electron packaging remains available, but this is **optional for local browser use**:

    npm.cmd install
    npm.cmd run desktop
    npm.cmd run build

Build outputs go to `dist/` when a build succeeds. The local browser website and Electron package share the same HTML/CSS/JavaScript code.

## Test the source

With Node.js installed:

    node --test tests/*.test.mjs

The project uses JavaScript for question generation, timers, movement, scoring and saving browser results. It does not need a Python backend or remote database.

## Project files

| File | What it does |
| --- | --- |
| `index.html` | Top navigation and page structure |
| `styles.css`, `themes.css`, `assessment.css` | Layout, Light/Dark themes, cockpit displays and test screens |
| `frontend.js` | Dashboard, navigation, theme switching and results screens |
| `assessment-runtime.mjs` | Runs the tests, reads keys, updates timers and draws Control/Slalom |
| `assessment-core.mjs`, `core.mjs` | Generates questions and calculates scores |
| `web-server.cjs` | Opens a local browser website without any extra packages |
| `electron/main.cjs` | Optional desktop application |
| `tests/` | Checks that assessment calculations and important features work |

**Note:** This is independent training software. The scores are defined for this project, not validated for real pilot selection, certification or licensing. LocalStorage is not secure examination storage.
