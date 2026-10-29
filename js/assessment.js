// Browser-ready: works even when index.html is opened directly (file://).
window.AVAssess = (() => {
  'use strict';
// ============================================================
// assessment.js — test view renderers + per-module logic
// ============================================================

const { MODULES, state, app } = window.AVCore;
const { escapeHtml, clamp, rand, fmtTime, planeSvg } = window.AVUI;
// ---- public dispatch ----

function renderAssessment(s) {
  if (s.phase === 'complete') {
    // Imported lazily to avoid circular re-render issues; app.js handles complete screen.
    return null;
  }
  const views = {
    memory: memoryView, control: controlView, maths: mathView,
    slalom: slalomView, orientation: orientationView, task: taskView,
  };
  return views[s.module](s);
}

// ---- shared chrome ----

function runHead(s, help) {
  const progress =
    s.module === 'memory' ? `Round ${s.index + 1} of ${s.total}` :
    (s.module === 'maths' || s.module === 'orientation') ? `Question ${s.index + 1} of ${s.total}` :
    s.module === 'slalom' ? `Run ${s.run + 1} of ${s.totalRuns}` : '';
  const clockLabel = s.module === 'memory' && s.phase === 'recall' ? 'Answer time' : 'Time remaining';
  return `<div class="test-head">
    <div>
      <div class="crumb">${s.mode === 'practice' ? 'Practice · Unscored' : 'Scored assessment'}</div>
      <h1>${escapeHtml(MODULES[s.module].name)}</h1>
      <p>${escapeHtml(help)}${progress ? ' · ' + progress : ''}</p>
    </div>
    <div class="test-clock">
      <div class="label">${clockLabel}</div>
      <div class="time" id="timer">${fmtTime(s.remaining)}</div>
      <button class="btn secondary" data-action="stop" style="margin-top:6px" aria-label="Exit test without saving">Exit test</button>
    </div>
  </div>`;
}

// ============================================================
// MEMORY
// ============================================================

function memoryView(s) {
  const labels = { altitude: 'Altitude', speed: 'Airspeed', heading: 'Heading', radio: 'Radio' };
  const idents = { altitude: 'a', speed: 's', heading: 'h', radio: 'r' };

  const reading = Object.keys(labels).map(k => {
    const hide = s.phase === 'recall' && s.targets.includes(k);
    return `<div class="reading ${hide ? 'blank' : ''}">
      <label>${labels[k]} (${idents[k]})</label>
      <strong>${hide ? '•••' : escapeHtml(displayFlight(k, s.values[k]))}</strong>
    </div>`;
  }).join('');

  const studyBlock = s.phase === 'study'
    ? `<div class="panel" style="margin-top:14px">
        <div class="field-label">Memorisation window</div>
        <div style="height:6px;background:#e1e8ee;border-radius:1px;overflow:hidden">
          <div id="study-bar" style="height:100%;background:#1e5a8a;width:100%;transition:width .1s linear"></div>
        </div>
        <p class="small muted" style="margin-top:8px">Memorise all four readings — they will be concealed automatically.</p>
      </div>`
    : '';

  const recallBlock = s.phase === 'recall'
    ? `<section class="panel" style="margin-top:14px">
        <h3 class="panel-title">Recall — fill in the concealed values</h3>
        <form id="memory-answer">
          <div class="field-grid">
            ${s.targets.map(k => `<label class="field-group">
              <span class="field-label">${labels[k]}</span>
              <input class="field" name="${k}" inputmode="decimal" autocomplete="off" required placeholder="e.g. 240 or 240${idents[k]}">
            </label>`).join('')}
          </div>
          <button class="btn primary" type="submit">Submit recall</button>
        </form>
      </section>`
    : '';

  return runHead(s, s.phase === 'study' ? 'Memorise the flight data shown below.' : 'Enter the concealed readings.')
    + `<div class="panel"><div class="readings">${reading}</div>${studyBlock}</div>${recallBlock}`;
}

function displayFlight(k, v) {
  if (k === 'altitude') return Number(v).toLocaleString('en-US') + ' ft';
  if (k === 'speed') return v + ' kts';
  if (k === 'heading') return String(v).padStart(3, '0') + '°';
  if (k === 'radio') return v + ' MHz';
  return v;
}

function submitMemory(form) {
  const s = state.session;
  if (!s || s.module !== 'memory' || s.phase !== 'recall') return;

  const data = new FormData(form);
  let right = 0;
  for (const k of s.targets) {
    if (gradeFlight(k, data.get(k), s.values[k])) right++;
  }
  s.roundCorrect += right;
  s.roundTotal += s.targets.length;
  s.seconds.push((performance.now() - s.phaseBegan) / 1000);
  s.index++;

  if (s.index >= s.total) {
    const avg = s.seconds.reduce((a, b) => a + b, 0) / s.seconds.length;
    app.finish(gradeSpeed(s.roundCorrect, s.roundTotal, avg, 22),
      `${s.roundCorrect} of ${s.roundTotal} readings correct. Average recall time ${avg.toFixed(1)} s.`);
  } else {
    randomMemoryRound(s);
    app.refresh();
  }
}

function randomMemoryRound(s) {
  let difficulty = s.difficulty;
  if (s.mode === 'assessment') {
    const steps = ['easy', 'medium', 'medium', 'hard', 'hard'];
    difficulty = steps[s.index] || 'hard';
  }
  const toHide = { easy: 1, medium: 2, hard: 4 }[difficulty];
  const fields = ['altitude', 'speed', 'heading', 'radio'];
  s.targets = fields.slice().sort(() => Math.random() - 0.5).slice(0, toHide);
  s.values = randomFlight();
  s.phase = 'study';
  s.studiedFor = { easy: 8, medium: 6, hard: 5 }[difficulty];
  s.remaining = s.studiedFor;
  s.phaseBegan = performance.now();
}

function randomFlight() {
  return {
    altitude: rand(40, 290) * 100,
    speed: rand(130, 350),
    heading: rand(0, 359),
    radio: (118 + rand(0, 180) / 100).toFixed(2),
  };
}

function gradeFlight(k, input, expected) {
  const raw = String(input ?? '').replace(/[,\s]/g, '').toLowerCase();
  const clean = raw.replace(/[asrh]$/, '').replace(/(?:ft|kts|deg|mhz|°)$/, '');
  return clean !== '' && Number.isFinite(Number(clean)) && Number(clean) === Number(expected);
}

// ============================================================
// CONTROL — two-instrument compensatory tracking
// ============================================================

function controlView(s) {
  return runHead(s, 'Two stages: centre the dial needle first, then centre the horizontal ball.') + `
    <div class="workspace">
      <div class="instrument-panel">
        <div class="status-line" id="target-status">Stage 1 of 2 · Centre the needle with Up / Down</div>
        <div class="canvas-wrap">
          <canvas id="control-canvas" class="instrument" width="680" height="480" role="img"
            aria-label="Two compensatory tracking instruments: round dial with needle, horizontal bar with ball"></canvas>
        </div>
        <div class="legend">
          <span><i class="legend-dot blue"></i> Indicator (you control)</span>
          <span><i class="legend-dot red"></i> Target mark</span>
        </div>
      </div>
      <div class="telemetry-panel">
        <h3 class="panel-title">Live telemetry</h3>
        <div class="info-row"><span>Active stage</span><strong id="control-stage">Needle · 1 / 2</strong></div>
        <div class="info-row"><span>Time on target</span><strong id="control-target">0%</strong></div>
        <div class="info-row"><span>Mean deviation</span><strong id="control-distance">—</strong></div>
        <div class="info-row"><span>Corrections</span><strong id="control-presses">0</strong></div>
        <div class="keycaps" style="margin-top:14px">
          <span>Needle ↑: ${escapeHtml(visibleKey(state.keys.up))}</span><span>Needle ↓: ${escapeHtml(visibleKey(state.keys.down))}</span>
          <span>Ball ←: ${escapeHtml(visibleKey(state.keys.left))}</span><span>Ball →: ${escapeHtml(visibleKey(state.keys.right))}</span>
        </div>
        <p class="small muted">Only one instrument is active at a time. First use Up/Down to centre the needle. In the second half use Left/Right to centre the ball.</p>

      </div>
    </div>`;
}

function updateControl(s, dt, time, wall) {
  const stage = time < s.duration / 2 ? 'needle' : 'ball';
  if (stage !== s.stage) {
    s.stage = stage;
    // Do not let a held key from stage 1 control stage 2.
    app.held.clear();
    s.ballX = -0.26; s.ballVel = 0;
    s.needleAngle = 0; s.needleVel = 0;
  }
  const inNeedle = stage === 'needle' ? (app.held.has('down') ? 1 : 0) - (app.held.has('up') ? 1 : 0) : 0;
  const inBall = stage === 'ball' ? (app.held.has('right') ? 1 : 0) - (app.held.has('left') ? 1 : 0) : 0;

  const driftNeedle = 0.55 * Math.sin(time * 0.9 + 1.2) + 0.30 * Math.sin(time * 2.1 + 0.4) + 0.15 * Math.sin(time * 4.3);
  const driftBall   = 0.50 * Math.cos(time * 0.85 + 0.6) + 0.28 * Math.sin(time * 1.9 + 2.1) + 0.12 * Math.cos(time * 3.7);

  const damping = Math.exp(-2.8 * dt);
  if (stage === 'needle') s.needleVel = (s.needleVel + (driftNeedle + inNeedle * 3.4) * dt) * damping;
  if (stage === 'ball') s.ballVel = (s.ballVel + (driftBall + inBall * 3.4) * dt) * damping;

  s.needleAngle = clamp(s.needleAngle + s.needleVel * dt, -1.2, 1.2);
  s.ballX       = clamp(s.ballX       + s.ballVel   * dt, -1,   1);

  const needleDev = Math.abs(s.needleAngle) / 1.2;
  const ballDev   = Math.abs(s.ballX);
  const deviation = stage === 'needle' ? needleDev : ballDev;
  const onTarget = deviation < 0.14;

  const measured = wall > 0.25 ? wall : dt;
  s.measureTime += measured;
  s.deviationArea += deviation * measured;
  if (wall <= 0.25 && onTarget) s.onTarget += dt;

  // live readouts
  const pct = document.querySelector('#control-target');
  const dv  = document.querySelector('#control-distance');
  const pr  = document.querySelector('#control-presses');
  const st  = document.querySelector('#target-status');
  const stageEl = document.querySelector('#control-stage');
  if (stageEl) stageEl.textContent = stage === 'needle' ? 'Needle · 1 / 2' : 'Ball · 2 / 2';
  if (pct) pct.textContent = Math.round(100 * s.onTarget / Math.max(0.001, s.measureTime)) + '%';
  if (dv)  dv.textContent  = (100 * s.deviationArea / Math.max(0.001, s.measureTime)).toFixed(1) + '%';
  if (pr)  pr.textContent  = s.corrections;
  if (st) {
    st.textContent = onTarget ? (stage === 'needle' ? 'Needle centred — hold steady' : 'Ball centred — hold steady') : (stage === 'needle' ? 'Stage 1 · Use ↑ / ↓ to centre the needle' : 'Stage 2 · Use ← / → to centre the ball');
    st.className = 'status-line ' + (onTarget ? 'good' : 'warn');
  }
}

function drawControl(s) {
  const canvas = document.querySelector('#control-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = '#e8eef2';
  ctx.fillRect(0, 0, w, h);

  // ---- Round dial ----
  const cx = w / 2, cy = 190, R = 150;

  // Outer metallic ring
  const ring = ctx.createRadialGradient(cx - 30, cy - 30, R * 0.7, cx, cy, R * 1.08);
  ring.addColorStop(0, '#cbd6dd');
  ring.addColorStop(0.6, '#9aabb6');
  ring.addColorStop(1, '#6d7e89');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();

  // Face
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1a24';
  ctx.fill();

  // Ticks
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const long = i % 3 === 0;
    const r1 = long ? R * 0.82 : R * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98);
    ctx.strokeStyle = long ? '#7f9aaa' : '#4a6070';
    ctx.lineWidth = long ? 2 : 1;
    ctx.stroke();
  }

  // Tolerance arc
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.95, -Math.PI / 2 - 0.14, -Math.PI / 2 + 0.14);
  ctx.strokeStyle = 'rgba(217,74,78,0.30)';
  ctx.lineWidth = 14;
  ctx.stroke();

  // Target mark
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.95, -Math.PI / 2 - 0.09, -Math.PI / 2 + 0.09);
  ctx.strokeStyle = '#e04848';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Needle
  const na = -Math.PI / 2 + s.needleAngle;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(na) * R * 0.88, cy + Math.sin(na) * R * 0.88);
  ctx.strokeStyle = '#3fa9e8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Hub
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#e0e8ee';
  ctx.fill();
  ctx.strokeStyle = '#3fa9e8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label
  ctx.fillStyle = '#566a76';
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(s.stage === 'needle' ? 'STAGE 1 · ACTIVE NEEDLE  (↑ / ↓)' : 'STAGE 1 · COMPLETED', cx, cy - R - 12);

  // ---- Rectangle bar ----
  const bx = 80, bw = w - 160, by = 400, bh = 56;

  ctx.fillStyle = '#8a99a4';
  ctx.fillRect(bx - 10, by - 10, bw + 20, bh + 20);
  ctx.fillStyle = '#0f1a24';
  ctx.fillRect(bx, by, bw, bh);

  for (let i = 0; i <= 20; i++) {
    const tx = bx + (i / 20) * bw;
    const tall = i % 5 === 0;
    ctx.beginPath();
    ctx.moveTo(tx, by + bh - 4);
    ctx.lineTo(tx, by + bh - (tall ? 16 : 8));
    ctx.strokeStyle = tall ? '#7f9aaa' : '#4a6070';
    ctx.lineWidth = tall ? 2 : 1;
    ctx.stroke();
  }

  const centreX = bx + bw / 2;
  ctx.beginPath();
  ctx.moveTo(centreX, by);
  ctx.lineTo(centreX, by + bh);
  ctx.strokeStyle = 'rgba(217,74,78,0.30)';
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centreX, by);
  ctx.lineTo(centreX, by + bh);
  ctx.strokeStyle = '#e04848';
  ctx.lineWidth = 3;
  ctx.stroke();

  const ballX = centreX + s.ballX * (bw / 2 - 16);
  ctx.beginPath();
  ctx.arc(ballX, by + bh / 2, 12, 0, Math.PI * 2);
  ctx.fillStyle = '#3fa9e8';
  ctx.fill();
  ctx.strokeStyle = '#d8eefc';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#566a76';
  ctx.fillText(s.stage === 'ball' ? 'STAGE 2 · ACTIVE BALL  (← / →)' : 'STAGE 2 · NEXT', cx, by + bh + 26);
  // Visually distinguish the inactive instrument without hiding the reference.
  ctx.fillStyle = 'rgba(232,238,242,0.48)';
  if (s.stage === 'needle') ctx.fillRect(bx - 16, by - 16, bw + 32, bh + 32);
  else ctx.fillRect(cx - R - 10, cy - R - 10, 2 * R + 20, 2 * R + 20);
}

function finishControl() {
  const s = state.session;
  if (!s || s.module !== 'control') return;
  const duration = Math.max(0.001, s.measureTime);
  const on = 100 * s.onTarget / duration;
  const dev = clamp(s.deviationArea / duration, 0, 1);
  const score = Math.round(0.7 * on + 30 * (1 - dev));
  app.finish(score,
    `Two sequential stages completed · ${Math.round(on)}% time on target · mean deviation ${Math.round(dev * 100)}% · ${s.corrections} corrections.`,
    { timeOnTarget: Math.round(on), meanDeviation: Math.round(dev * 100), corrections: s.corrections });
}

// ============================================================
// MATHEMATICS
// ============================================================

function mathView(s) {
  return runHead(s, 'Read each question and enter only the numeric answer.') + `
    <div class="panel">
      <div class="eyebrow">Question ${s.index + 1} / ${s.total}</div>
      <div style="font-size:19px;font-weight:600;line-height:1.5;margin:16px 0 22px;max-width:800px">
        ${escapeHtml(s.question.prompt)}
      </div>
      <form id="math-answer">
        <label class="field-label" for="math-number">Your answer (number only)</label>
        <div class="form-actions">
          <input id="math-number" name="answer" type="number" step="any" class="field" style="max-width:220px" required autocomplete="off">
          <button class="btn primary" type="submit">Submit answer</button>
        </div>
      </form>
    </div>`;
}

function submitMath(form) {
  const s = state.session;
  if (!s || s.module !== 'maths') return;
  const raw = String(new FormData(form).get('answer') ?? '').trim();
  if (raw !== '' && Number(raw) === s.question.answer) s.correct++;
  s.seconds.push((performance.now() - s.questionStarted) / 1000);
  s.index++;

  if (s.index >= s.total) {
    const avg = s.seconds.reduce((a, b) => a + b, 0) / s.seconds.length;
    app.finish(gradeSpeed(s.correct, s.total, avg, 30),
      `${s.correct} of ${s.total} correct · average answer time ${avg.toFixed(1)} s.`);
  } else {
    s.question = mathQuestion();
    s.questionStarted = performance.now();
    app.refresh();
  }
}

function mathQuestion() {
  const type = rand(0, 4);
  let answer, prompt;
  if (type === 0) {
    const speed = rand(7, 22) * 10, hrs = rand(2, 5);
    answer = speed;
    prompt = `An aircraft flies ${speed * hrs} km in ${hrs} hours. What is its average speed in km/h?`;
  } else if (type === 1) {
    const rate = rand(7, 18) * 10, hrs = rand(2, 4);
    answer = rate * hrs;
    prompt = `An aircraft uses ${rate} litres of fuel per hour. How many litres will it use in ${hrs} hours?`;
  } else if (type === 2) {
    const speed = rand(8, 25) * 10, hrs = rand(2, 4);
    answer = speed * hrs;
    prompt = `An aircraft flies at ${speed} km/h for ${hrs} hours. How many kilometres does it travel?`;
  } else if (type === 3) {
    const speed = rand(8, 22) * 10, hrs = rand(2, 5);
    answer = hrs;
    prompt = `A flight is ${speed * hrs} km long. At ${speed} km/h, how many hours does it take?`;
  } else {
    const distance = rand(6, 25) * 10;
    answer = distance * 2;
    prompt = `An aircraft travels ${distance} km in 30 minutes. What is its average speed in km/h?`;
  }
  return { prompt, answer };
}

// ============================================================
// SLALOM
// ============================================================

function slalomView(s) {
  return runHead(s, 'Steer left or right to pass through each gap.') + `
    <div class="workspace">
      <div class="instrument-panel">
        <div class="canvas-wrap">
          <canvas id="slalom-canvas" class="instrument" width="620" height="480" role="img"
            aria-label="Aircraft steering through pairs of coloured markers"></canvas>
        </div>
        <div class="legend"><span><i class="legend-dot blue"></i> Aircraft</span><span><i class="legend-dot red"></i> Gate markers</span></div>
      </div>
      <div class="telemetry-panel">
        <h3 class="panel-title">Run status</h3>
        <div class="info-row"><span>Gates passed</span><strong id="gate-count">0</strong></div>
        <div class="info-row"><span>Centred passes</span><strong id="gate-hit">0</strong></div>
        <div class="info-row"><span>Run</span><strong>${s.run + 1} / ${s.totalRuns}</strong></div>
        <div class="info-row"><span>Gate speed</span><strong id="slalom-speed">1.0×</strong></div>
        <div class="info-row"><span>Obstacles avoided</span><strong id="slalom-avoid">0 / 0</strong></div>
        <p class="small muted">Speed and obstacles increase gradually. Avoid yellow hazard markers while steering through gates.</p>
        <div class="keycaps" style="margin-top:14px"><span>Left: ${escapeHtml(visibleKey(state.keys.left))}</span><span>Right: ${escapeHtml(visibleKey(state.keys.right))}</span></div>

      </div>
    </div>`;
}

function updateSlalom(s, dt) {
  const side = (app.held.has('right') ? 1 : 0) - (app.held.has('left') ? 1 : 0);
  s.x = clamp(s.x + side * 1.65 * dt, -0.92, 0.92);
  // Increase speed by up to 110% over a scored run; later runs begin slightly faster.
  s.speedFactor = 1 + 0.75 * (s.elapsed / s.duration) + 0.16 * s.run;
  const travelSpeed = 112 * s.speedFactor;
  s.nextGate -= dt;
  if (s.nextGate <= 0) {
    s.gates.push({ y: -20, centre: Math.sin((s.elapsed + 1) * 0.94) * 0.53, done: false });
    s.nextGate += Math.max(0.83, 1.85 - s.elapsed / s.duration * 0.65 - s.run * 0.12);
  }
  // New hazards are independent of gate pairs and become more frequent over time.
  s.nextHazard -= dt;
  if (s.nextHazard <= 0) {
    const side = Math.sin(s.elapsed * 2.3) > 0 ? 1 : -1;
    s.hazards.push({ y: -24, x: side * (0.35 + 0.16 * Math.sin(s.elapsed)), done: false });
    s.nextHazard += Math.max(2.1, 5.9 - 3 * (s.elapsed / s.duration) - 0.35 * s.run);
  }
  for (const g of s.gates) {
    g.y += travelSpeed * dt;
    if (!g.done && g.y >= 368) {
      g.done = true;
      s.totalGates++;
      const dist = Math.abs(s.x - g.centre);
      if (dist < 0.24) s.hits++;
      s.centerScore += clamp(1 - dist / 0.6, 0, 1);
    }
  }
  s.gates = s.gates.filter(g => g.y < 480);
  for (const hazard of s.hazards) {
    hazard.y += travelSpeed * dt;
    if (!hazard.done && hazard.y >= 368) {
      hazard.done = true;
      s.obstacleCount++;
      if (Math.abs(s.x - hazard.x) > 0.17) s.obstacleAvoided++;
    }
  }
  s.hazards = s.hazards.filter(h => h.y < 490);
  const sp = document.querySelector('#slalom-speed');
  const av = document.querySelector('#slalom-avoid');
  if (sp) sp.textContent = s.speedFactor.toFixed(1) + '×';
  if (av) av.textContent = s.obstacleAvoided + ' / ' + s.obstacleCount;

  const gc = document.querySelector('#gate-count');
  const gh = document.querySelector('#gate-hit');
  if (gc) gc.textContent = s.totalGates;
  if (gh) gh.textContent = s.hits;
}

function drawSlalom(s) {
  const canvas = document.querySelector('#slalom-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = '#0f1a24';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#1f3345';
  ctx.lineWidth = 1;
  for (let x = 40; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 25; y < h; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  const cx = w / 2;
  for (const g of s.gates) {
    const middle = cx + g.centre * 215;
    ctx.beginPath(); ctx.arc(middle - 58, g.y, 11, 0, Math.PI * 2); ctx.fillStyle = '#d94a4e'; ctx.fill();
    ctx.beginPath(); ctx.arc(middle + 58, g.y, 11, 0, Math.PI * 2); ctx.fillStyle = '#5fbf8f'; ctx.fill();
  }

  for (const h of s.hazards) {
    const hx = cx + h.x * 215;
    ctx.beginPath(); ctx.moveTo(hx, h.y - 13); ctx.lineTo(hx + 13, h.y + 10);
    ctx.lineTo(hx - 13, h.y + 10); ctx.closePath();
    ctx.fillStyle = '#eab35b'; ctx.fill(); ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffe4b4'; ctx.stroke();
    ctx.fillStyle = '#172532'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('!', hx, h.y + 7);
  }
  const px = cx + s.x * 215, py = 368;
  ctx.fillStyle = '#3fa9e8';
  ctx.strokeStyle = '#d8eefc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py - 16);
  ctx.lineTo(px - 16, py + 14);
  ctx.lineTo(px, py + 6);
  ctx.lineTo(px + 16, py + 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function slalomNext() {
  const s = state.session;
  if (!s || s.module !== 'slalom') return;
  const acc = s.totalGates ? s.hits / s.totalGates : 0;
  const prec = s.totalGates ? s.centerScore / s.totalGates : 0;
  const avoid = s.obstacleCount ? s.obstacleAvoided / s.obstacleCount : 1;
  s.runResults.push(Math.round(100 * (0.5 * acc + 0.3 * prec + 0.2 * avoid)));

  if (s.run + 1 < s.totalRuns) {
    s.run++;
    resetSlalom(s);
    app.refresh();
    app.restartLoop();
    return;
  }
  const score = s.runResults.reduce((a, b) => a + b, 0) / s.runResults.length;
  app.finish(score, `${s.totalRuns} run(s) completed · average score ${Math.round(score)} / 100.`);
}

function resetSlalom(s) {
  s.x = 0;
  s.gates = [];
  s.hazards = [];
  s.nextGate = 0;
  s.nextHazard = 3.1;
  s.obstacleCount = 0;
  s.obstacleAvoided = 0;
  s.speedFactor = 1;
  s.elapsed = 0;
  s.remaining = s.duration;
  s.totalGates = 0;
  s.hits = 0;
  s.centerScore = 0;
  s.runStart = performance.now();
}

// ============================================================
// ORIENTATION
// ============================================================

function orientationView(s) {
  const q = s.question;
  return runHead(s, 'Identify the aircraft that matches all three instrument readings.') + `
    <div class="panel">
      <h3 class="panel-title">Instrument readings</h3>
      <div class="orientation-instruments">
        <div><small>RBI</small><strong>${q.bearing}°</strong></div>
        <div><small>Artificial horizon</small><strong>${q.pitch > 0 ? '+' : ''}${q.pitch}°</strong></div>
        <div><small>Compass</small><strong>${String(q.head).padStart(3, '0')}°</strong></div>
      </div>
      <h3 style="margin-bottom:10px">Which aircraft matches?</h3>
      <div class="aircraft-options">
        ${q.options.map((o, i) => `
          <button class="aircraft-option" data-choice="${i}">
            <span class="num">${i + 1}</span>
            ${planeSvg(o.heading)}
            <span>Heading ${String(o.heading).padStart(3, '0')}°<br><small>Pitch ${o.pitch > 0 ? '+' : ''}${o.pitch}° · Bearing ${o.bearing}°</small></span>
          </button>`).join('')}
      </div>
      <p class="small muted" style="margin-top:12px">Tip: press 1, 2, 3 or 4 on the keyboard.</p>
    </div>`;
}

function submitOrientation(choice) {
  const s = state.session;
  if (!s || s.module !== 'orientation' || s.phase === 'complete') return;
  if (Number(choice) === s.question.correct) s.correct++;
  s.index++;
  if (s.index >= s.total) {
    app.finish((s.correct / s.total) * 100,
      `${s.correct} of ${s.total} correct. Incorrect answers were not penalised.`);
  } else {
    s.question = orientationQuestion();
    app.refresh();
  }
}

function orientationQuestion() {
  const heads = [0, 45, 90, 135, 180, 225, 270, 315];
  const pitches = [-10, -5, 0, 5, 10];
  const bearings = [0, 90, 180, 270];

  const head = heads[rand(0, 7)];
  const pitch = pitches[rand(0, 4)];
  const bearing = bearings[rand(0, 3)];
  const correct = rand(0, 3);
  const options = [];
  for (let i = 0; i < 4; i++) {
    if (i === correct) options.push({ heading: head, pitch, bearing });
    else options.push({
      heading: (head + (i + 1) * 45) % 360,
      pitch: pitch + (i % 2 ? 5 : 0),
      bearing: (bearing + 90 * (i + 1)) % 360,
    });
  }
  return { head, pitch, bearing, options, correct };
}

// ============================================================
// TASK MANAGER
// ============================================================

function taskView(s) {
  return runHead(s, 'Copy the new autopilot values and acknowledge every warning.') + `
    <div class="workspace">
      <div class="instrument-panel">
        <h3 class="panel-title">New autopilot values</h3>
        <div class="task-grid">
          <div><span>Altitude</span><strong>${s.target.altitude.toLocaleString()} ft</strong></div>
          <div><span>Heading</span><strong>${String(s.target.heading).padStart(3, '0')}°</strong></div>
          <div><span>Speed</span><strong>${s.target.speed} kts</strong></div>
        </div>
        <form id="task-answer">
          <div class="task-inputs">
            <label class="field-group"><span class="field-label">Altitude</span><input class="field" name="altitude" inputmode="numeric" required></label>
            <label class="field-group"><span class="field-label">Heading</span><input class="field" name="heading" inputmode="numeric" required></label>
            <label class="field-group"><span class="field-label">Speed</span><input class="field" name="speed" inputmode="numeric" required></label>
          </div>
          <button class="btn primary" type="submit">Apply values</button>
        </form>
        <p class="small muted" style="margin-top:10px">Correct copies: <strong id="task-count">${s.appliedCorrect} / ${s.applied}</strong></p>
      </div>
      <div class="telemetry-panel">
        <h3 class="panel-title">Warning alerts</h3>
        <div class="alert-box ${s.alertActive ? 'active' : ''}" id="alert-status">
          ${s.alertActive ? '● WARNING — PRESS ' + escapeHtml(visibleKey(state.keys.alert)) : 'No active warnings'}
        </div>
        <button class="btn secondary" data-action="ack" style="margin-top:10px">Acknowledge (${escapeHtml(visibleKey(state.keys.alert))})</button>
        <p class="small muted" style="margin-top:10px">Cleared: <strong id="task-alerts">${s.alertsCorrect} / ${s.alerts}</strong></p>
      </div>
    </div>`;
}

function submitTask(form) {
  const s = state.session;
  if (!s || s.module !== 'task') return;
  const data = new FormData(form);
  const num = v => Number(String(v ?? '').replace(/[,\s]/g, ''));
  s.applied++;
  if (num(data.get('altitude')) === s.target.altitude &&
      num(data.get('heading')) === s.target.heading &&
      num(data.get('speed')) === s.target.speed) s.appliedCorrect++;
  s.target = newTaskValues();
  app.refresh();
}

function clearAlert() {
  const s = state.session;
  if (!s || s.module !== 'task' || !s.alertActive) return;
  s.alertActive = false;
  s.alertsCorrect++;
  s.reactionSum += (performance.now() - s.alertStarted) / 1000;
  updateTaskUI(s);
}

function updateTaskUI(s) {
  const status = document.querySelector('#alert-status');
  if (status) {
    status.textContent = s.alertActive ? '● WARNING — PRESS ' + visibleKey(state.keys.alert) : 'No active warnings';
    status.classList.toggle('active', s.alertActive);
  }
  const c = document.querySelector('#task-count');
  const a = document.querySelector('#task-alerts');
  if (c) c.textContent = `${s.appliedCorrect} / ${s.applied}`;
  if (a) a.textContent = `${s.alertsCorrect} / ${s.alerts}`;
}

function updateTaskAlerts(s, now) {
  const elapsed = s.duration - s.remaining;
  const expected = Math.floor(elapsed / 8);
  if (expected > s.alerts) {
    s.alerts = expected;
    s.alertActive = true;
    s.alertStarted = now;
    updateTaskUI(s);
  }
}

function finishTask() {
  const s = state.session;
  if (!s || s.module !== 'task') return;
  const acc = s.applied ? (100 * s.appliedCorrect / s.applied) : 0;
  const ack = s.alerts ? (100 * s.alertsCorrect / s.alerts) : 100;
  const speed = s.alertsCorrect ? 100 * clamp(1 - s.reactionSum / s.alertsCorrect / 5, 0, 1) : 0;
  app.finish(0.55 * acc + 0.30 * ack + 0.15 * speed,
    `${s.appliedCorrect} / ${s.applied} values copied · ${s.alertsCorrect} / ${s.alerts} alerts cleared.`);
}

function newTaskValues() {
  return { altitude: rand(4, 32) * 1000, heading: rand(0, 35) * 10, speed: rand(14, 35) * 10 };
}

// ---- shared helpers ----

function gradeSpeed(correct, total, avgSeconds, allowed = 30) {
  if (!total) return 0;
  const accuracy = correct / total;
  const speed = clamp(1 - avgSeconds / allowed, 0, 1);
  return Math.round(100 * (0.85 * accuracy + 0.15 * speed));
}

function visibleKey(k) {
  if (k.startsWith('Arrow')) return k.replace('Arrow', '');
  if (k === 'Space') return 'Space';
  if (k.startsWith('Key')) return k.slice(3);
  return k;
}

return { renderAssessment, submitMemory, randomMemoryRound, controlView, updateControl, drawControl, finishControl, mathView, submitMath, slalomView, updateSlalom, drawSlalom, slalomNext, resetSlalom, orientationView, submitOrientation, taskView, submitTask, clearAlert, updateTaskAlerts, finishTask, gradeSpeed };
})();
