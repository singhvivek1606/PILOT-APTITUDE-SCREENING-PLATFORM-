import {
  PARAMETERS, MEMORY_ROUNDS, ASSESSMENT_LIMIT, CONTROL_DURATION_SECONDS,
  PRACTICE_CONTROL_SECONDS, TRIAL_CONTROL_SECONDS, clamp, difficultyForRound,
  studySeconds, generateMemoryRound, displayMemoryValue,
  evaluateMemoryAnswers, summarizeMemoryRounds, summarizeControl, formatTime
} from "./core.mjs";

const STORAGE_KEY = "aerovector.v1.history";
const ATTEMPTS_KEY = "aerovector.v1.attempts";
const main = document.getElementById("page-content");
const toastEl = document.getElementById("toast");
const heldKeys = new Set();
const pages = ["home", "memory", "control", "results"];
let intervalId = null, frameId = null, toastId = null;
let history = safeRead(STORAGE_KEY, []);
let attempts = safeRead(ATTEMPTS_KEY, { memory: 0, control: 0 });
if (!Array.isArray(history)) history = [];
if (!attempts || typeof attempts !== "object") attempts = { memory: 0, control: 0 };
const state = {
  page: "home",
  choices: { memory: { mode: "practice", difficulty: "easy" }, control: { mode: "practice" } },
  memory: null,
  control: null
};

function safeRead(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { toast("Browser storage unavailable; results may not persist."); return false; }
}
function toast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;
  if (toastId) clearTimeout(toastId);
  toastId = setTimeout(() => { toastEl.hidden = true; }, 3300);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function percent(value) {
  return clamp(Number(value) || 0, 0, 100);
}
function remainingAttempts(module) {
  return Math.max(0, ASSESSMENT_LIMIT - (Number(attempts[module]) || 0));
}
function clearActivity() {
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
  heldKeys.clear();
  if (state.control) state.control.touchDirection = "";
}
function navigate(page) {
  if (!pages.includes(page)) page = "home";
  if (state.page !== page && ((state.memory && ["study", "recall"].includes(state.memory.phase)) ||
      (state.control && state.control.phase === "running"))) {
    if (!window.confirm("Leave the active test? Unsaved progress will be lost.")) return;
  }
  clearActivity();
  state.memory = null;
  state.control = null;
  state.page = page;
  if (location.hash !== "#" + page) window.history.replaceState(null, "", "#" + page);
  render();
  window.scrollTo({ top: 0, behavior: "auto" });
}
function render() {
  document.getElementById("page-crumb").textContent = ({
    home: "Overview", memory: "Memory test", control: "Control test", results: "Results dashboard"
  })[state.page] || "Overview";
  document.querySelectorAll(".nav-link").forEach(link => {
    const active = link.dataset.page === state.page;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (state.page === "home") main.innerHTML = homeView();
  else if (state.page === "memory") main.innerHTML = state.memory ? memoryGameView() : memoryWelcomeView();
  else if (state.page === "control") main.innerHTML = state.control ? controlGameView() : controlWelcomeView();
  else main.innerHTML = resultsView();
}

function homeView() {
  const assessments = history.filter(x => x && x.mode === "assessment");
  const last = assessments[0];
  const mem = assessments.filter(x => x.module === "memory");
  const con = assessments.filter(x => x.module === "control");
  const bestMemory = mem.length ? Math.max(...mem.map(x => Number(x.score) || 0)) + "%" : "—";
  const bestControl = con.length ? Math.max(...con.map(x => Number(x.score) || 0)) + "%" : "—";
  return `
    <section class="hero">
      <div>
        <div class="eyebrow">✦ &nbsp; THE NEXT GENERATION OF AVIATORS</div>
        <h1>Train your mind.<br><em>Sharpen your instincts.</em></h1>
        <p>Build the focus, memory and hand-eye coordination demanded in the cockpit. Two focused assessments. Clear performance insights. Your progress starts here.</p>
        <div class="actions">
          <button class="btn btn-primary" data-page="memory">Start training <span aria-hidden="true">↗</span></button>
          <button class="btn btn-secondary" data-page="results">View dashboard ↗</button>
        </div>
      </div>
      <div class="hero-graphic" aria-hidden="true"><div class="radar-sweep"></div><div class="radar-cross-h"></div><div class="radar-cross-v"></div><div class="radar-center"></div></div>
    </section>
    <div class="section-heading"><h2>Your flight deck</h2><span>MISSION CONTROL / 02 MODULES</span></div>
    <section class="module-grid" aria-label="Available tests">
      <article class="module-card">
        <span class="module-icon" aria-hidden="true">◈</span>
        <span class="pill" style="position:absolute;top:28px;right:25px">COGNITIVE</span>
        <h3>Memory recall</h3><p>Memorize changing flight parameters, then reproduce them under time pressure.</p>
        <div class="card-bottom"><span>01 / SHORT-TERM MEMORY</span><button class="btn btn-secondary btn-sm" data-page="memory">Explore module →</button></div>
      </article>
      <article class="module-card blue">
        <span class="module-icon" aria-hidden="true">◎</span>
        <span class="pill blue" style="position:absolute;top:28px;right:25px">PSYCHOMOTOR</span>
        <h3>Control tracking</h3><p>Counter simulated turbulence and keep your indicator aligned with the target.</p>
        <div class="card-bottom"><span>02 / HAND–EYE COORDINATION</span><button class="btn btn-secondary btn-sm" data-page="control">Explore module →</button></div>
      </article>
    </section>
    <div class="section-heading"><h2>Training snapshot</h2><span>ASSESSMENT RESULTS ONLY</span></div>
    <div class="stats-row">
      <div class="stat-card"><span>Completed assessments</span><strong>${assessments.length}</strong><small>sessions</small></div>
      <div class="stat-card"><span>Best memory score</span><strong>${bestMemory}</strong></div>
      <div class="stat-card"><span>Best control score</span><strong>${bestControl}</strong></div>
    </div>
    <p class="small muted" style="margin-top:20px">${last ? "Most recent assessment: " + escapeHtml(last.module) + " · " + escapeHtml(new Date(last.date).toLocaleDateString()) : "No scored assessments yet. Begin with a practice session to learn the controls."}</p>
  `;
}
function modeChoices(module) {
  const mode = state.choices[module].mode;
  return `<div class="mode-selector" role="group" aria-label="Choose testing mode">
    <button class="mode-choice ${mode === "practice" ? "selected" : ""}" data-mode-for="${module}" data-mode="practice" aria-pressed="${mode === "practice"}">
      <strong>◈ &nbsp; Practice mode</strong><small>Unlimited trials. Helpful feedback. No saved scores.</small>
    </button>
    <button class="mode-choice ${mode === "assessment" ? "selected" : ""}" data-mode-for="${module}" data-mode="assessment" aria-pressed="${mode === "assessment"}">
      <strong>◎ &nbsp; Assessment mode</strong><small>Timed and scored. Includes a short warm-up trial. ${remainingAttempts(module)} of ${ASSESSMENT_LIMIT} attempts left.</small>
    </button>
  </div>`;
}
function memoryWelcomeView() {
  const mode = state.choices.memory.mode;
  const difficulty = state.choices.memory.difficulty;
  return `
    <div class="panel-intro"><div><div class="eyebrow">MODULE 01 / COGNITIVE</div><h1 class="page-title">Memory recall</h1><p class="page-subtitle">Observe four flight parameters, hold them in your memory, then recall the requested values accurately.</p></div><span class="pill">READY TO TRAIN</span></div>
    <div class="split-grid">
      <section class="card"><h2 style="margin:0;font-size:19px">Configure your session</h2>
        ${modeChoices("memory")}
        <div class="form-row"><label for="difficulty-select">Starting difficulty</label>
        <select id="difficulty-select">
          <option value="easy" ${difficulty === "easy" ? "selected" : ""}>Easy — 8s / 1 answer</option>
          <option value="medium" ${difficulty === "medium" ? "selected" : ""}>Medium — 6s / 2 answers</option>
          <option value="hard" ${difficulty === "hard" ? "selected" : ""}>Hard — 5s / 4 answers</option>
        </select></div>
        <p class="small muted">${mode === "assessment" ? "5 scored rounds after one unscored trial. Difficulty may increase each round." : "Continuous rounds with feedback. You can leave or restart at any time."}</p>
        <button class="btn btn-primary" data-action="start-memory" ${mode === "assessment" && !remainingAttempts("memory") ? "disabled" : ""}>${mode === "assessment" ? "Start warm-up trial" : "Start practice"} →</button>
        ${mode === "assessment" && !remainingAttempts("memory") ? '<p class="small text-red">Assessment limit reached in this browser. Practice is still available.</p>' : ""}
      </section>
      <section class="card">
        <h2 style="margin:0 0 14px;font-size:19px">How it works</h2>
        <div class="instructions"><strong>Remember these four cockpit readings:</strong><ol>
          <li>Altitude (a) — aircraft height</li><li>Speed (s) — aircraft speed</li>
          <li>Heading (h) — compass direction</li><li>Radio (r) — communication frequency</li>
        </ol></div>
        <div class="rule-separator"></div>
        <p class="small muted">All four readings appear briefly. One or more disappear. Enter the missing values, optionally using letter suffixes such as <strong>240s</strong>.</p>
        <p class="small muted"><strong>Scoring:</strong> 85% recall accuracy + 15% response-speed score. Response-speed score = max(0, 100 − 4 × average seconds).</p>
      </section>
    </div>`;
}
function startMemory() {
  const { mode, difficulty } = state.choices.memory;
  if (mode === "assessment" && !remainingAttempts("memory")) { toast("No scored attempts remain. Try practice mode."); return; }
  state.memory = { mode, difficulty, isTrial: mode === "assessment", index: 0, rounds: [], phase: "" };
  beginMemoryRound();
}
function beginMemoryRound() {
  if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
  const m = state.memory;
  if (!m) return;
  const difficulty = m.isTrial ? "easy" : (m.mode === "assessment" ? difficultyForRound(m.difficulty, m.index) : m.difficulty);
  m.round = generateMemoryRound(difficulty);
  if (m.isTrial) m.round.targets = [m.round.targets[0]];
  m.phase = "study";
  m.studyDuration = m.isTrial ? 5 : studySeconds(difficulty);
  m.studyStarted = performance.now();
  render();
  intervalId = setInterval(() => {
    if (!state.memory || state.memory !== m || m.phase !== "study") return;
    const remaining = Math.max(0, m.studyDuration - (performance.now() - m.studyStarted) / 1000);
    const clock = document.getElementById("study-remaining");
    const bar = document.getElementById("study-progress");
    if (clock) clock.textContent = remaining.toFixed(1) + "s";
    if (bar) bar.style.width = (remaining / m.studyDuration * 100) + "%";
    if (remaining <= 0) {
      clearInterval(intervalId); intervalId = null;
      m.phase = "recall";
      m.recallStarted = performance.now();
      render();
      const firstInput = main.querySelector("[data-answer]");
      if (firstInput) firstInput.focus();
    }
  }, 45);
}
function memoryValues(round, concealed) {
  return PARAMETERS.map(p => {
    const hidden = concealed && round.targets.includes(p.key);
    return `<div class="instrument-value ${hidden ? "is-hidden" : ""}">
      <span>${p.label} / ${p.suffix.toUpperCase()}</span>
      <strong>${hidden ? "— — —" : displayMemoryValue(p.key, round.values[p.key])}</strong>
      <small>${p.unit}</small>
    </div>`;
  }).join("");
}
function memoryGameView() {
  const m = state.memory;
  if (m.phase === "complete") return memorySummaryView();
  const label = m.isTrial ? "WARM-UP / UNSCORED" : m.mode === "assessment" ? "ASSESSMENT" : "PRACTICE";
  const roundText = m.isTrial ? "Trial round" : m.mode === "assessment" ? "Round " + (m.index + 1) + " / " + MEMORY_ROUNDS : "Practice round " + (m.index + 1);
  if (m.phase === "feedback") {
    const r = m.last;
    const items = r.details.map(d => `<div class="feedback-item ${d.correct ? "good" : "bad"}">
      <strong>${escapeHtml(PARAMETERS.find(p => p.key === d.key).label)} ${d.correct ? "✓" : "✕"}</strong>
      <span>You: ${escapeHtml(d.actual || "—")} · Correct: ${escapeHtml(displayMemoryValue(d.key, d.expected))}</span>
    </div>`).join("");
    return `<div class="panel-intro"><div><div class="eyebrow">MODULE 01 / ${label}</div><h1 class="page-title">Round feedback</h1><p class="page-subtitle">${roundText} · ${escapeHtml(m.round.difficulty)} difficulty</p></div></div>
      <section class="card" style="max-width:800px"><span class="pill ${r.correct === r.total ? "" : "gold"}">${r.correct} / ${r.total} CORRECT</span>
      <h2>${r.correct === r.total ? "Excellent recall!" : "Keep improving your recall"}</h2>
      <p class="small muted">You answered in ${m.last.recallSeconds.toFixed(1)} seconds. ${m.isTrial ? "This was only a warm-up; your assessment attempts are still untouched." : ""}</p>
      <div class="feedback-grid">${items}</div>
      <div class="actions">
        <button class="btn btn-primary" data-action="next-memory">${m.isTrial ? "Begin scored assessment" : m.mode === "assessment" && m.index === MEMORY_ROUNDS - 1 ? "View final result" : "Next round"} →</button>
        <button class="btn btn-ghost" data-page="memory">Exit session</button>
      </div></section>`;
  }
  const study = m.phase === "study";
  const targetFields = m.round.targets.map(key => {
    const p = PARAMETERS.find(x => x.key === key);
    return `<div class="recall-input"><label for="answer-${key}">${p.label} (${p.suffix})</label>
      <input id="answer-${key}" data-answer="${key}" autocomplete="off" inputmode="decimal" required placeholder="Enter remembered value" aria-label="Recall ${p.label}"></div>`;
  }).join("");
  return `
    <div class="panel-intro"><div><div class="eyebrow">MODULE 01 / ${label}</div><h1 class="page-title">${study ? "Memorize the readings" : "Recall the missing data"}</h1>
      <p class="page-subtitle">${roundText} · ${escapeHtml(m.round.difficulty)} difficulty · ${study ? "Focus on all four values." : "Enter the values that disappeared."}</p></div>
      <span class="pill ${study ? "gold" : "blue"}">${study ? "MEMORIZE" : "RECALL"}</span></div>
    <div class="game-shell">
      <div class="game-top"><div><strong>FLIGHT DATA / ${roundText.toUpperCase()}</strong><br><small>${study ? "Parameters will disappear when the timer reaches zero." : m.round.targets.length + " parameter(s) hidden — recall from memory"}</small></div>
      ${study ? '<div class="callout"><span>TIME LEFT</span><strong id="study-remaining">' + m.studyDuration.toFixed(1) + 's</strong></div>' : '<span class="pill blue">INPUT REQUIRED</span>'}</div>
      ${study ? '<div class="progress-track"><div id="study-progress" style="width:100%"></div></div>' : ""}
      <div class="game-body">
        <div class="memory-display">${memoryValues(m.round, !study)}</div>
        ${study ? '<div class="callout">◉ &nbsp; Commit the values to memory before they disappear.</div>' :
          '<form id="memory-form"><div class="answer-grid">' + targetFields + '</div><div class="actions"><button class="btn btn-primary" type="submit">Submit answers →</button><span class="small muted">Numbers only, or add a/s/h/r suffixes.</span></div></form>'}
      </div>
    </div>`;
}
function submitMemory() {
  const m = state.memory;
  if (!m || m.phase !== "recall") return;
  const answers = {};
  main.querySelectorAll("[data-answer]").forEach(input => { answers[input.dataset.answer] = input.value; });
  const evaluation = evaluateMemoryAnswers(m.round, answers);
  const recallSeconds = Math.max(0, (performance.now() - m.recallStarted) / 1000);
  m.last = { ...evaluation, recallSeconds };
  if (!m.isTrial) m.rounds.push({ correct: evaluation.correct, total: evaluation.total, recallSeconds, difficulty: m.round.difficulty });
  m.phase = "feedback";
  render();
}
function nextMemory() {
  const m = state.memory;
  if (!m || m.phase !== "feedback") return;
  if (m.isTrial) {
    if (!remainingAttempts("memory")) { navigate("memory"); return; }
    attempts.memory = (Number(attempts.memory) || 0) + 1;
    safeWrite(ATTEMPTS_KEY, attempts);
    m.isTrial = false;
    m.index = 0;
    beginMemoryRound();
  } else if (m.mode === "assessment" && m.index + 1 >= MEMORY_ROUNDS) {
    const summary = summarizeMemoryRounds(m.rounds);
    m.result = { id: Date.now() + "-memory", date: new Date().toISOString(), module: "memory",
      mode: "assessment", difficulty: m.difficulty, ...summary };
    saveResult(m.result);
    m.phase = "complete";
    render();
  } else {
    m.index += 1;
    beginMemoryRound();
  }
}
function memorySummaryView() {
  const r = state.memory.result;
  return `<div class="eyebrow">MODULE 01 / COMPLETE</div><h1 class="page-title">Memory assessment complete</h1>
    <section class="result-hero"><span class="pill">ASSESSMENT FINISHED</span><div class="score-number">${r.score}<small>/100</small></div>
      <h2>Recall performance</h2><p>Overall score combines 85% accuracy and 15% recall speed. Your completed result is saved locally on this device.</p>
      <div class="actions" style="justify-content:center"><button class="btn btn-primary" data-page="results">View dashboard →</button><button class="btn btn-secondary" data-page="memory">Back to Memory</button></div>
    </section>
    <div class="metric-grid"><div class="metric-card"><label>Accuracy</label><strong>${r.accuracy}%</strong></div>
      <div class="metric-card"><label>Average recall time</label><strong>${r.avgRecallSec}s</strong></div>
      <div class="metric-card"><label>Correct responses</label><strong>${r.correct}/${r.total}</strong></div></div>`;
}
function controlWelcomeView() {
  const mode = state.choices.control.mode;
  return `<div class="panel-intro"><div><div class="eyebrow">MODULE 02 / PSYCHOMOTOR</div><h1 class="page-title">Control tracking</h1>
    <p class="page-subtitle">Counter drifting forces in real time. Your goal: keep the yellow ball as close to the central red target as possible.</p></div><span class="pill blue">READY TO TRACK</span></div>
    <div class="split-grid">
      <section class="card"><h2 style="margin:0;font-size:19px">Configure your session</h2>
      ${modeChoices("control")}
      <div class="info-line"><span>◷ &nbsp;<strong>${mode === "assessment" ? "60 seconds" : "25 seconds"}</strong> duration</span><span>⌨ &nbsp; <strong>WASD / arrow keys</strong></span></div>
      <button class="btn btn-primary" data-action="start-control" ${mode === "assessment" && !remainingAttempts("control") ? "disabled" : ""}>${mode === "assessment" ? "Start 12-second warm-up" : "Start practice"} →</button>
      ${mode === "assessment" && !remainingAttempts("control") ? '<p class="small text-red">Assessment limit reached in this browser. Practice is still available.</p>' : ""}
      </section>
      <section class="card"><h2 style="margin:0 0 14px;font-size:19px">How it works</h2>
        <div class="instructions"><strong>Compensate for simulated turbulence:</strong><ol>
          <li>The yellow ball drifts on its own.</li><li>Use <strong>← ↑ ↓ →</strong> or <strong>W A S D</strong> to push it back.</li>
          <li>Try to keep the ball inside the red center ring.</li><li>Limit unnecessary direction changes for smoother corrections.</li>
        </ol></div>
        <div class="rule-separator"></div><p class="small muted"><strong>Scoring:</strong> 60% time on target + 30% proximity + 10% correction smoothness. Your average deviation and number of corrections are also reported.</p>
        <p class="small muted">On a tablet, use the on-screen directional pad while the test is running.</p>
      </section>
    </div>`;
}
function startControl() {
  const { mode } = state.choices.control;
  if (mode === "assessment" && !remainingAttempts("control")) { toast("No scored attempts remain. Try practice mode."); return; }
  state.control = { mode, isTrial: mode === "assessment", phase: "" };
  beginControlRun();
}
function beginControlRun() {
  if (frameId !== null) { cancelAnimationFrame(frameId); frameId = null; }
  heldKeys.clear();
  const c = state.control;
  if (!c) return;
  c.phase = "running";
  c.touchDirection = "";
  c.duration = c.isTrial ? TRIAL_CONTROL_SECONDS : c.mode === "assessment" ? CONTROL_DURATION_SECONDS : PRACTICE_CONTROL_SECONDS;
  c.startedAt = performance.now();
  c.lastFrame = c.startedAt;
  c.ball = { x: .33, y: -.22, vx: 0, vy: 0 };
  c.stats = { totalMs: 0, onTargetMs: 0, deviationIntegral: 0, corrections: 0 };
  c.lastDirection = "";
  render();
  const canvas = document.getElementById("control-canvas");
  if (canvas) canvas.focus();
  frameId = requestAnimationFrame(controlFrame);
}
function controlGameView() {
  const c = state.control;
  if (c.phase === "complete" || c.phase === "trial-end") return controlSummaryView();
  const label = c.isTrial ? "WARM-UP / UNSCORED" : c.mode === "assessment" ? "ASSESSMENT" : "PRACTICE";
  return `<div class="panel-intro"><div><div class="eyebrow">MODULE 02 / ${label}</div><h1 class="page-title">Stabilize the indicator</h1><p class="page-subtitle">Correct drift continuously. The central red ring is your target zone.</p></div><span class="pill gold">◉ LIVE TRACKING</span></div>
  <section class="game-shell">
    <div class="game-top"><div><strong>COMPENSATORY TRACKING / AXIS X–Y</strong><br><small>${c.isTrial ? "Warm-up run: no scores saved" : "Keep movement smooth and controlled"}</small></div>
      <div class="callout"><span>TIME LEFT</span><strong id="control-time">${formatTime(c.duration)}</strong></div></div>
    <div class="progress-track"><div id="control-progress" style="width:0%"></div></div>
    <div class="game-body">
      <div class="control-layout">
        <div>
          <div class="canvas-wrap"><canvas id="control-canvas" width="680" height="440" tabindex="0" aria-label="Moving ball control tracking instrument"></canvas></div>
          <p class="center small muted">Use <span class="kbd">W</span> <span class="kbd">A</span> <span class="kbd">S</span> <span class="kbd">D</span> or your <span class="kbd">ARROW KEYS</span> to counter the drift</p>
        </div>
        <div class="control-readouts">
          <div class="readout good"><label>TIME ON TARGET</label><strong id="control-ontarget">0%</strong><br><small>within center ring</small></div>
          <div class="readout"><label>AVERAGE DEVIATION</label><strong id="control-deviation">0.0</strong><small>/ 100</small></div>
          <div class="readout"><label>CORRECTIONS</label><strong id="control-corrections">0</strong><br><small>direction changes</small></div>
          <div class="readout"><label>TABLET / TOUCH CONTROLS</label>
            <div class="pad" aria-label="Hold a button to steer">
              <span class="pad-empty"></span><button data-hold="up" aria-label="Move up">↑</button><span class="pad-empty"></span>
              <button data-hold="left" aria-label="Move left">←</button><span class="pad-empty"></span><button data-hold="right" aria-label="Move right">→</button>
              <span class="pad-empty"></span><button data-hold="down" aria-label="Move down">↓</button><span class="pad-empty"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}
function direction() {
  const c = state.control;
  let x = 0, y = 0;
  if (heldKeys.has("arrowleft") || heldKeys.has("a") || c.touchDirection === "left") x -= 1;
  if (heldKeys.has("arrowright") || heldKeys.has("d") || c.touchDirection === "right") x += 1;
  if (heldKeys.has("arrowup") || heldKeys.has("w") || c.touchDirection === "up") y -= 1;
  if (heldKeys.has("arrowdown") || heldKeys.has("s") || c.touchDirection === "down") y += 1;
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}
function controlFrame(now) {
  const c = state.control;
  if (!c || c.phase !== "running") return;
  const durationMs = c.duration * 1000;
  const elapsedMs = clamp(now - c.startedAt, 0, durationMs);
  const wallDtMs = Math.max(0, elapsedMs - c.stats.totalMs);
  const dt = clamp((now - c.lastFrame) / 1000, 0, .045);
  c.lastFrame = now;
  const t = elapsedMs / 1000;
  const input = direction();
  const signature = Math.round(input.x) + "/" + Math.round(input.y);
  if ((input.x || input.y) && c.lastDirection && c.lastDirection !== signature) c.stats.corrections++;
  c.lastDirection = input.x || input.y ? signature : "";
  // Smooth deterministic turbulence and a damped velocity response.
  const driftX = .55 * Math.sin(t * 1.23 + 1.1) + .38 * Math.sin(t * 2.9);
  const driftY = .57 * Math.sin(t * 1.56 + 2.1) + .30 * Math.cos(t * 3.2);
  const friction = Math.pow(.90, dt * 60);
  c.ball.vx = c.ball.vx * friction + (driftX + 4.4 * input.x) * dt;
  c.ball.vy = c.ball.vy * friction + (driftY + 4.4 * input.y) * dt;
  c.ball.x += c.ball.vx * dt;
  c.ball.y += c.ball.vy * dt;
  for (const axis of ["x", "y"]) {
    if (Math.abs(c.ball[axis]) > .92) {
      c.ball[axis] = clamp(c.ball[axis], -.92, .92);
      c.ball["v" + axis] *= -.3;
    }
  }
  const deviation = Math.hypot(c.ball.x, c.ball.y);
  // A long background-tab pause counts against the score, not as free on-target time.
  if (wallDtMs <= 250 && deviation <= .19) c.stats.onTargetMs += wallDtMs;
  c.stats.deviationIntegral += (wallDtMs > 250 ? 1 : deviation) * wallDtMs;
  c.stats.totalMs = elapsedMs;
  drawControl(c);
  const metrics = summarizeControl(c.stats);
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText("control-time", formatTime((durationMs - elapsedMs) / 1000));
  setText("control-ontarget", metrics.onTarget + "%");
  setText("control-deviation", metrics.avgDeviation.toFixed(1));
  setText("control-corrections", String(metrics.corrections));
  const bar = document.getElementById("control-progress");
  if (bar) bar.style.width = (100 * elapsedMs / durationMs) + "%";
  if (elapsedMs >= durationMs) { finishControl(); return; }
  frameId = requestAnimationFrame(controlFrame);
}
function drawControl(c) {
  const canvas = document.getElementById("control-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(100, rect.width), h = Math.max(100, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pxW = Math.round(w * dpr), pxH = Math.round(h * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) { canvas.width = pxW; canvas.height = pxH; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, radius = Math.min(w * .37, h * .43);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.2);
  gradient.addColorStop(0, "#143248"); gradient.addColorStop(1, "#081c2e");
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.13, 0, 2 * Math.PI); ctx.fill();
  for (let step = 1; step <= 4; step++) {
    ctx.beginPath(); ctx.arc(cx, cy, radius * step / 4, 0, 2 * Math.PI);
    ctx.strokeStyle = step === 4 ? "#7292a7" : "#31546b";
    ctx.lineWidth = step === 4 ? 2 : 1; ctx.stroke();
  }
  ctx.strokeStyle = "#48677d"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - radius * 1.1, cy); ctx.lineTo(cx + radius * 1.1, cy);
  ctx.moveTo(cx, cy - radius * 1.1); ctx.lineTo(cx, cy + radius * 1.1); ctx.stroke();
  for (let a = 0; a < 360; a += 15) {
    const angle = a * Math.PI / 180;
    const start = a % 45 === 0 ? .93 : .97;
    ctx.beginPath(); ctx.moveTo(cx + radius * start * Math.cos(angle), cy + radius * start * Math.sin(angle));
    ctx.lineTo(cx + radius * 1.03 * Math.cos(angle), cy + radius * 1.03 * Math.sin(angle));
    ctx.strokeStyle = "#91b3c4"; ctx.lineWidth = a % 45 === 0 ? 2 : 1; ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, radius * .19, 0, 2 * Math.PI);
  ctx.fillStyle = "#e9636622"; ctx.fill(); ctx.strokeStyle = "#ff737b"; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10); ctx.stroke();
  const bx = cx + c.ball.x * radius, by = cy + c.ball.y * radius;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.strokeStyle = "#e8dc7d68"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.shadowColor = "#f9d376"; ctx.shadowBlur = 23;
  ctx.beginPath(); ctx.arc(bx, by, 10, 0, 2 * Math.PI); ctx.fillStyle = "#ffe18c"; ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = "#fff3c6"; ctx.stroke();
  ctx.fillStyle = "#8cabc0"; ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left"; ctx.fillText("TRACK / LIVE", 14, 19);
  ctx.textAlign = "right"; ctx.fillText("TARGET ±19%", w - 14, 19);
  ctx.textAlign = "center"; ctx.fillText("X " + c.ball.x.toFixed(2) + "  /  Y " + c.ball.y.toFixed(2), cx, h - 12);
}
function finishControl() {
  if (frameId !== null) cancelAnimationFrame(frameId);
  frameId = null;
  heldKeys.clear();
  const c = state.control;
  if (!c || c.phase !== "running") return;
  c.metrics = summarizeControl(c.stats);
  c.phase = c.isTrial ? "trial-end" : "complete";
  if (!c.isTrial && c.mode === "assessment") {
    c.result = { id: Date.now() + "-control", date: new Date().toISOString(), mode: "assessment", module: "control", ...c.metrics };
    saveResult(c.result);
  }
  render();
}
function controlSummaryView() {
  const c = state.control;
  const r = c.metrics;
  const trial = c.phase === "trial-end";
  return `<div class="eyebrow">MODULE 02 / ${trial ? "WARM-UP COMPLETE" : "RUN COMPLETE"}</div>
    <h1 class="page-title">${trial ? "Ready for assessment?" : "Control tracking result"}</h1>
    <section class="result-hero"><span class="pill ${trial ? "gold" : ""}">${trial ? "UNSCORED PRACTICE TRIAL" : c.mode === "assessment" ? "ASSESSMENT FINISHED" : "PRACTICE FINISHED"}</span>
      <div class="score-number">${r.score}<small>/100</small></div><h2>${trial ? "You have completed the warm-up" : "Tracking performance"}</h2>
      <p>${trial ? "Warm-up numbers are only feedback. Begin the real 60-second test when ready." : c.mode === "assessment" ? "Your result is saved locally on this device." : "Practice scores are not added to your official assessment history."}</p>
      <div class="actions" style="justify-content:center">
        ${trial ? '<button class="btn btn-primary" data-action="begin-control-assessment">Begin 60-second assessment →</button>' : c.mode === "assessment" ? '<button class="btn btn-primary" data-page="results">View dashboard →</button>' : '<button class="btn btn-primary" data-action="start-control">Practice again →</button>'}
        <button class="btn btn-secondary" data-page="control">Back to Control</button>
      </div>
    </section>
    <div class="metric-grid">
      <div class="metric-card"><label>Time on target</label><strong>${r.onTarget}%</strong></div>
      <div class="metric-card"><label>Average deviation</label><strong>${r.avgDeviation}</strong><small>/100</small></div>
      <div class="metric-card"><label>Direction corrections</label><strong>${r.corrections}</strong></div>
    </div>
    <div class="instructions"><strong>Score formula:</strong> 60% time-on-target + 30% proximity (100 minus average deviation) + 10% smoothness (100 minus 35 × corrections / duration in seconds; minimum zero). A ball is on target when its distance is within 19% of gauge radius.</div>`;
}
function saveResult(result) {
  history.unshift(result);
  history = history.slice(0, 200);
  safeWrite(STORAGE_KEY, history);
}
function resultsView() {
  const assessments = history.filter(x => x && x.mode === "assessment" && ["memory", "control"].includes(x.module));
  const mem = assessments.filter(x => x.module === "memory");
  const ctrl = assessments.filter(x => x.module === "control");
  const avg = list => list.length ? Math.round(list.reduce((sum, x) => sum + (Number(x.score) || 0), 0) / list.length) : null;
  const cards = [
    { label: "Completed assessments", value: assessments.length, unit: "sessions" },
    { label: "Average Memory score", value: avg(mem) === null ? "—" : avg(mem) + "%", unit: "" },
    { label: "Average Control score", value: avg(ctrl) === null ? "—" : avg(ctrl) + "%", unit: "" }
  ];
  let body = `<div class="panel-intro"><div><div class="eyebrow">YOUR PERFORMANCE / ANALYTICS</div><h1 class="page-title">Results dashboard</h1><p class="page-subtitle">Review scored assessment history. Practice sessions and warm-up trials do not affect your results.</p></div>
    <div class="actions"><button class="btn btn-secondary btn-sm" data-action="export-json" ${assessments.length ? "" : "disabled"}>↓ Export JSON</button><button class="btn btn-ghost btn-sm" data-action="clear-data">Clear data</button></div></div>
    <div class="stats-row">${cards.map(card => '<div class="stat-card"><span>' + card.label + '</span><strong>' + card.value + '</strong><small>' + card.unit + '</small></div>').join("")}</div>`;
  if (!assessments.length) return body + `<div class="section-heading"><h2>Flight record</h2></div><div class="empty-state">
    <div class="empty-icon">◇</div><h2>No assessment results yet</h2><p>Complete a scored Memory or Control test to start building your performance history.</p>
    <div class="actions" style="justify-content:center"><button class="btn btn-primary" data-page="memory">Start Memory test</button><button class="btn btn-secondary" data-page="control">Start Control test</button></div>
    </div>`;
  const rows = assessments.map(r => `<tr><td>${escapeHtml(new Date(r.date).toLocaleString())}</td><td>${r.module === "memory" ? "◈ Memory" : "◎ Control"}</td>
    <td><span class="pill ${r.score >= 75 ? "" : r.score >= 45 ? "gold" : "red"}">${percent(r.score)} / 100</span></td>
    <td>${r.module === "memory" ? percent(r.accuracy) + "% correct" : percent(r.onTarget) + "% on target"}</td></tr>`).join("");
  const chartLines = (title, list) => `<section class="card"><h3 style="margin-top:0">${title}</h3>
    ${list.length ? list.slice(0, 6).reverse().map((r, i) => `<div class="bar-line"><label>Attempt ${i+1}</label>
      <div class="bar-bg"><div class="bar-fill" style="width:${percent(r.score)}%"></div></div><strong>${percent(r.score)}%</strong></div>`).join("") : '<p class="small muted">No completed assessments yet.</p>'}
    </section>`;
  return body + `<div class="section-heading"><h2>Score trends</h2><span>LATEST 6 / EACH MODULE</span></div>
    <div class="two-col">${chartLines("◈ Memory scores", mem)}${chartLines("◎ Control scores", ctrl)}</div>
    <div class="section-heading"><h2>Assessment history</h2><span>${assessments.length} RECORDED</span></div>
    <div class="card table-scroll"><table class="history-table"><thead><tr><th>When</th><th>Module</th><th>Score</th><th>Key metric</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="small muted">Assessment attempts remaining — Memory: ${remainingAttempts("memory")} / ${ASSESSMENT_LIMIT} · Control: ${remainingAttempts("control")} / ${ASSESSMENT_LIMIT}. These limits apply only to this browser and can be reset with local data.</p>`;
}
function exportJSON() {
  if (!history.length) return;
  const payload = { app: "AeroVector Pilot Aptitude Lab", exportedAt: new Date().toISOString(), attempts, results: history };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "pilot-aptitude-results.json"; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
document.addEventListener("click", event => {
  const el = event.target.closest("[data-page],[data-mode-for],[data-action]");
  if (!el) return;
  if (el.dataset.page) { event.preventDefault(); navigate(el.dataset.page); return; }
  if (el.dataset.modeFor) {
    state.choices[el.dataset.modeFor].mode = el.dataset.mode;
    render(); return;
  }
  switch (el.dataset.action) {
    case "start-memory": startMemory(); break;
    case "next-memory": nextMemory(); break;
    case "start-control": startControl(); break;
    case "begin-control-assessment":
      if (!state.control || state.control.phase !== "trial-end") return;
      if (!remainingAttempts("control")) { navigate("control"); return; }
      attempts.control = (Number(attempts.control) || 0) + 1;
      safeWrite(ATTEMPTS_KEY, attempts);
      state.control.isTrial = false; beginControlRun(); break;
    case "export-json": exportJSON(); break;
    case "clear-data":
      if (!window.confirm("Delete all assessment results and reset attempt limits in this browser?")) return;
      history = []; attempts = { memory: 0, control: 0 };
      safeWrite(STORAGE_KEY, history); safeWrite(ATTEMPTS_KEY, attempts);
      toast("Local assessment data cleared."); render(); break;
  }
});
document.addEventListener("change", event => {
  if (event.target.id === "difficulty-select") {
    if (["easy","medium","hard"].includes(event.target.value)) state.choices.memory.difficulty = event.target.value;
  }
});
document.addEventListener("submit", event => {
  if (event.target.id === "memory-form") { event.preventDefault(); submitMemory(); }
});
window.addEventListener("keydown", event => {
  if (state.page !== "control" || !state.control || state.control.phase !== "running") return;
  if (["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault(); heldKeys.add(key);
  }
});
window.addEventListener("keyup", event => { heldKeys.delete(event.key.toLowerCase()); });
window.addEventListener("blur", () => { heldKeys.clear(); if (state.control) state.control.touchDirection = ""; });
document.addEventListener("pointerdown", event => {
  const el = event.target.closest("[data-hold]");
  if (!el || !state.control || state.control.phase !== "running") return;
  event.preventDefault();
  state.control.touchDirection = el.dataset.hold;
  if (el.setPointerCapture) el.setPointerCapture(event.pointerId);
});
function releaseTouch() { if (state.control) state.control.touchDirection = ""; }
document.addEventListener("pointerup", releaseTouch);
document.addEventListener("pointercancel", releaseTouch);
window.addEventListener("hashchange", () => {
  const p = location.hash.slice(1);
  if (pages.includes(p) && p !== state.page) navigate(p);
});
const initial = location.hash.slice(1);
state.page = pages.includes(initial) ? initial : "home";
render();