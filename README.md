# AeroVector — Aviation Pilot Aptitude Screening Platform

A local-first, keyboard-operable training application based on Aviation Aptitude Hackathon Brief v2.0. HTML, CSS, JavaScript, and Canvas/SVG power the interface. Electron packages the same files as a native Windows executable.

> Independent educational prototype inspired by COMPASS-type assessment categories. Not affiliated with EPST or COMPASS. Not validated for real airline selection, licensing or certification.

## Implemented modules and functionality

- Introduction: Candidate registration with all required brief fields, validation, and Enter-to-next-field behavior.
- Memory: Altitude, speed, heading and radio. 8/6/5-second study windows, five increasingly difficult scored rounds or practice, accuracy and response time scoring.
- Control: Canvas horizontal needle and vertical ball, continuous held-key corrections, 20-second practice or 60-second assessment; time-on-target and deviation scoring.
- Mathematics: Eight speed, distance, time and fuel questions, numerical response validation, accuracy and response-time scoring.
- Slalom: Descending red/green marker pairs; left/right keyboard controls; three 90-second scored runs or one shorter practice run.
- Orientation: Static RBI, artificial horizon and compass indications; four selectable aircraft alternatives, keyboard 1–4; ten-minute time limit.
- Task Manager: Concurrent autopilot setting transfers and alert acknowledgment; correct entries, alert count and speed contribute to the result.
- Settings: Remap up/down/left/right/alert keys. Duplicate mappings rejected.
- Results and history: Scores and candidate information stored locally, per-module summaries, optional sample results clearly labeled, JSON export only of real results.
- Two themes: Light and Dark, with cockpit instruments remaining dark in both.

## Run in a browser

Run the following from the project directory, with Python installed:

    python -m http.server 8000

Open http://localhost:8000.

## Run as a Windows desktop app

Install Node.js LTS and run:

    npm install
    npm start

Build the Windows executable or installer on a Windows machine:

    npm run build

Build artifacts are placed in the dist folder. A GitHub Actions workflow also builds Windows artifacts. The repository does not ship a prebuilt executable.

## Tests

    npm run check
    npm test

## Files

| File | Role |
| --- | --- |
| index.html | Page shell and navigation |
| styles.css, themes.css, assessment.css | Responsive styling, themes and assessment panels |
| frontend.js | Navigation, dashboard, results, history and theme logic |
| assessment-runtime.mjs | Assessment state, timers, keyboard control, Canvas animation, saved results |
| assessment-core.mjs, core.mjs | Pure question generation, scoring, grade validation |
| electron/main.cjs | Native Electron startup, sandboxed renderer |
| package.json | Electron start/build commands |
| tests | Automated checks |

## Controls

Control: Arrow keys and, under default settings, WASD. Slalom: left/right. Orientation: number keys 1–4. Mathematics: numeric answers and Enter. Task Manager: fill autopilot values, Enter to apply and Space to acknowledge an alert (configurable in Settings).

Practice is unscored and never saved as an assessment. Scored sessions require candidate registration. All stored information is local to the browser or Electron profile; LocalStorage is not tamper-resistant or suitable for formal proctoring.

## Scoring

Memory: 85% accuracy and 15% response-speed score. Mathematics: 85% accuracy and 15% response speed. Control: 70% time on target and 30% center proximity. Slalom: 70% gate success and 30% central position. Orientation: correct answers / total (no penalty for wrong answers). Task Manager: 55% autopilot correctness, 30% acknowledged alerts, 15% alert response speed.

These are deliberately transparent hackathon scoring formulas, not validated professional selection norms. The static cockpit preview is visual context, while active assessments are dynamic screens. The Windows build and manual acceptance testing must be verified separately from JavaScript unit tests.
