# AeroVector — Pilot Aptitude Screening Platform

An independent aviation-inspired aptitude training web app built with **HTML, CSS, and JavaScript only**. It includes two working tests: short-term **Memory Recall** and **Compensatory Control Tracking**, plus local assessment history and performance charts.

> **Disclaimer:** This is a hackathon prototype inspired by general aptitude screening exercises. It is not COMPASS™ software, is not affiliated with EPST, and must not be used to make real pilot selection or licensing decisions without appropriate validation.

## Run locally

No Node packages, frontend framework, build step, API key, database, or login is required.

1. Download or clone this repository.
2. Open a terminal inside the project folder.
3. Start any simple HTTP server. If Python is installed:

   ~~~bash
   python -m http.server 8000
   ~~~

4. Visit **http://localhost:8000**.

ES modules require an HTTP server in many browsers, so opening index.html directly with file:// is not recommended.

## Features

### Memory Recall (Module 01)
- Four randomized flight parameters: altitude (FT), speed (KTS), heading (DEG), and radio (MHz).
- Easy (8s, 1 blank), Medium (6s, 2 blanks), Hard (5s, 4 blanks).
- Practice mode offers unlimited rounds with immediate feedback.
- Assessment mode includes an **unscored warm-up** followed by **5 scored rounds**, with difficulty progression.
- Accepts plain values (e.g. 240) or letter suffixes (e.g. 240s).
- Measures accuracy, average response time, and weighted score.

**Memory score:** 85% × accuracy (%) + 15% × speed score (%), rounded to the nearest whole number. Speed score = max(0, 100 − 4 × average recall time in seconds).

### Control Tracking (Module 02)
- Moving ball on a custom Canvas flight instrument with smooth simulated turbulence.
- Arrow keys or WASD; on-screen directional pad for tablet input.
- Practice: 25 seconds. Assessment: an **unscored 12-second warm-up**, followed by a **60-second scored run**.
- Measures time on target (distance within 19% of gauge radius), mean deviation, and direction corrections.
- Pauses in background tabs are counted as off-target time, to discourage exploiting inactive tabs.

**Control score:** 60% × time-on-target (%) + 30% × proximity score (%) + 10% × smoothness score (%), rounded to the nearest whole number.

- Proximity score = clamp(100 − mean deviation as a percentage of gauge radius, 0, 100).
- Smoothness score = clamp(100 − 35 × direction changes ÷ duration in seconds, 0, 100).

These scoring formulas are hackathon choices, not scientifically validated pilot aptitude norms.

### Dashboard
- Recent results and average/best scores.
- Progress charts for up to 6 recent scored attempts per module.
- Detailed attempt table and JSON export.
- LocalStorage persistence (browser-only). Practice results are never saved as scored attempts.
- Two assessment starts per module per browser; clearing browser data resets limits. This is a UX limit, not secure server-enforced proctoring.

## Tests

Unit tests use the built-in Node test runner (Node 20+ recommended):

~~~bash
node --test tests/core.test.mjs
~~~

Tests cover difficulty progression, memory question generation, answer normalization, scoring, control calculations, and timer formatting.

## Project files

| File | Responsibility |
| --- | --- |
| index.html | App shell, navigation, and accessible main content |
| styles.css | Responsive aviation-inspired UI |
| core.mjs | Pure randomized data generation and transparent scoring |
| app.js | Page rendering, gameplay, Canvas tracking, timers, local history |
| tests/core.test.mjs | Dependency-free unit tests |

## Suggested live demo (3–5 minutes)

1. Show the overview page and both modules.
2. Run an Easy Memory practice round, then show the 5-round assessment flow.
3. Run Control practice and steer with WASD/arrow keys to stabilize the ball.
4. Show the results dashboard and JSON export.
5. Explain the scoring formulas and that results stay on the device.

## Future enhancements

- Candidate accounts, secure server-side attempt tracking, verified assessments.
- Gamepad/joystick support and adaptive difficulty.
- Additional Orientation, Slalom, and divided-attention tasks.
- PDF report export and validated percentile benchmarks.

## Privacy

The app does not send test results to a server. Data stays in the browser's local storage unless the user exports it.