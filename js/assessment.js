// Browser-ready: works even when index.html is opened directly (file://).
window.AVAssess = (() => {
  "use strict";
  // ============================================================
  // assessment.js — test view renderers + per-module logic
  // ============================================================

  const { MODULES, MEMORY_LEVELS, MEMORY_RAMP, state, app } = window.AVCore;
  const { escapeHtml, clamp, rand, fmtTime, ring, planeSvg } = window.AVUI;
  // ---- public dispatch ----

  function renderAssessment(s) {
    if (s.phase === "complete") {
      // Imported lazily to avoid circular re-render issues; app.js handles complete screen.
      return null;
    }
    const views = {
      memory: memoryView,
      control: controlView,
      maths: mathView,
      slalom: slalomView,
      orientation: orientationView,
      task: taskView,
    };
    // .ins-test scopes the instrument design system (css/instrument.css) to test screens.
    return `<div class="ins-test ins-test-${s.module}">${views[s.module](s)}</div>`;
  }

  // ============================================================
  // HUD — shared in-test header (all six modules)
  // ============================================================

  function runHead(s, help) {
    const m = MODULES[s.module];
    const candidate = String(state.candidate?.first || "").trim();
    const meta = [
      `Module ${m.marker}`,
      s.mode === "practice" ? "Practice · unscored" : "Scored assessment",
      candidate && `Candidate ${candidate}`,
    ]
      .filter(Boolean)
      .map((t) => `<span>${escapeHtml(t)}</span>`)
      .join("");
    return `<header class="ins-head">
    <div class="ins-head-id">
      <div class="ins-head-meta">${meta}</div>
      <h1>${escapeHtml(m.name)}</h1>
      <p>${escapeHtml(help)}</p>
    </div>
    ${hudProgress(s)}
    <div class="ins-clock">
      <div class="ins-clock-read">
        <span class="ins-clock-label">${escapeHtml(clockLabel(s))}</span>
        <span class="ins-clock-time" id="timer">${fmtTime(s.remaining)}</span>
      </div>
      ${ring(hudFraction(s), {
        size: 40,
        stroke: 2,
        id: "timer-ring",
        cls: hudCaution(s) ? "caution" : "",
      })}
      <div class="ins-head-actions">
        <button class="ins-head-btn" data-action="back" aria-label="Go back to overview" title="Back to overview">Back</button>
        <button class="ins-head-btn" data-action="stop" aria-label="Exit test without saving" title="Exit without saving">Exit</button>
      </div>
    </div>
  </header>`;
  }

  function clockLabel(s) {
    if (s.module === "memory")
      return { ready: "Get ready", study: "Study time" }[s.phase] || "Answer time";
    return "Time remaining";
  }

  // Segmented progress: one hairline segment per round / question / run.
  function hudProgress(s) {
    const spec =
      s.module === "memory"
        ? ["Round", s.index, s.total]
        : s.module === "maths" || s.module === "orientation"
          ? ["Question", s.index, s.total]
          : s.module === "slalom"
            ? ["Run", s.run, s.totalRuns]
            : null;
    if (!spec || !spec[2]) return `<div class="ins-progress" aria-hidden="true"></div>`;
    const [label, index, total] = spec;
    const current = Math.min(index, total - 1);
    const pips = Array.from(
      { length: total },
      (_, i) =>
        `<i class="ins-pip ${i < current ? "done" : i === current ? "current" : ""}"></i>`,
    ).join("");
    return `<div class="ins-progress" role="img" aria-label="${label} ${current + 1} of ${total}">
      <div class="ins-progress-label">${label} <b>${current + 1}</b> of ${total}</div>
      <div class="ins-pips">${pips}</div>
    </div>`;
  }

  // 0–1 fill of the clock ring. Memory recall counts up towards the speed reference.
  function hudFraction(s) {
    if (s.module === "memory") {
      if (s.phase === "ready") return s.remaining / s.readyFor;
      if (s.phase === "study") return s.remaining / s.studiedFor;
      return clamp(s.remaining / MEMORY_RECALL_REF, 0, 1);
    }
    return s.duration ? clamp(s.remaining / s.duration, 0, 1) : 0;
  }

  function hudCaution(s) {
    if (s.module === "memory") {
      if (s.phase === "study") return s.remaining <= 2;
      return s.phase !== "ready" && s.remaining > MEMORY_RECALL_REF;
    }
    return s.duration > 0 && s.remaining <= Math.min(10, s.duration * 0.2);
  }

  // Called every frame by the tick loop, next to the #timer text update.
  function syncHud(s) {
    const el = document.querySelector("#timer-ring");
    if (!el) return;
    el.style.setProperty("--p", hudFraction(s).toFixed(3));
    el.classList.toggle("caution", hudCaution(s));
  }

  // ============================================================
  // MEMORY
  // ============================================================

  const MEMORY_FIELDS = {
    altitude: { label: "Altitude", code: "ALT", ident: "a", unit: "ft" },
    speed: { label: "Airspeed", code: "IAS", ident: "s", unit: "kts" },
    heading: { label: "Heading", code: "HDG", ident: "h", unit: "MAG" },
    radio: { label: "Radio", code: "COM", ident: "r", unit: "MHz" },
  };
  const MEMORY_READY = 2.4; // 3 · 2 · 1 countdown before each round (not timed)
  const MEMORY_REVIEW = 2.2; // per-round feedback before auto-advance
  const MEMORY_RECALL_REF = 22; // recall time that earns no speed credit (gradeSpeed)

  function memoryView(s) {
    const level = MEMORY_LEVELS[s.level];
    const help = {
      ready: "The flight data appears in a moment.",
      study: "Memorise all four readings.",
      recall: "Enter the hidden readings from memory.",
      feedback: "Round review.",
    }[s.phase];
    const phase = {
      ready: "Standby",
      study: "Memorise",
      recall: "Recall",
      feedback: "Review",
    }[s.phase];
    const cells = Object.keys(MEMORY_FIELDS)
      .map((k) => memoryCell(s, k))
      .join("");

    return (
      runHead(s, help) +
      `<form id="memory-answer" class="ins-panel phase-${s.phase}" autocomplete="off">
      <div class="ins-panel-head">
        <span class="ins-phase ${s.phase === "recall" ? "is-input" : ""}">${phase}</span>
        <span class="ins-panel-meta">${escapeHtml(level.label)} · ${level.study} s · ${s.targets.length} of 4 hidden</span>
        <span class="sr-only" aria-live="polite">${escapeHtml(memoryAnnouncement(s))}</span>
      </div>
      <div class="ins-strip">${cells}${s.phase === "ready" ? memoryCountdown(s) : ""}</div>
      ${memoryLine(s)}
      ${memoryFooter(s)}
    </form>`
    );
  }

  function memoryCell(s, k) {
    const f = MEMORY_FIELDS[k];
    const hidden =
      s.targets.includes(k) && (s.phase === "recall" || s.phase === "feedback");
    const top = `<div class="ins-cell-top"><span>${f.code}</span><span class="ins-ident">${f.ident}</span></div>`;
    const reading = (inner) =>
      `<div class="ins-readout">${inner}<span class="ins-unit">${f.unit}</span></div>`;
    const value = (text) => reading(`<strong class="ins-value">${text}</strong>`);
    const foot = (text, cls = "") =>
      `<div class="ins-cell-foot ${cls}">${text}</div>`;

    if (s.phase === "ready") {
      return `<div class="ins-cell is-blank">${top}${value("– – –")}${foot(f.label)}</div>`;
    }
    if (hidden && s.phase === "recall") {
      return `<label class="ins-cell is-input" for="mem-${k}">${top}${reading(
        `<input class="ins-input" id="mem-${k}" name="${k}" inputmode="decimal" autocomplete="off" spellcheck="false"
          required placeholder="– – –" aria-label="${f.label} (${f.unit})" data-memory-field>`,
      )}${foot(f.label)}</label>`;
    }
    if (hidden) {
      const r = s.rounds[s.rounds.length - 1];
      const ok = r.marks[k];
      return `<div class="ins-cell ${ok ? "is-ok" : "is-miss"}">${top}${value(escapeHtml(flightNumber(k, s.values[k])))}${foot(
        ok ? "✓ Correct" : `✗ Entered ${escapeHtml(r.answers[k] || "nothing")}`,
        "ins-verdict",
      )}</div>`;
    }
    return `<div class="ins-cell ${s.phase === "study" ? "is-live" : "is-dim"}">${top}${value(escapeHtml(flightNumber(k, s.values[k])))}${foot(f.label)}</div>`;
  }

  // Hairline under the strip: drains during study, fills during review.
  function memoryLine(s) {
    if (s.phase === "study")
      return `<div class="ins-line"><div id="study-bar" class="ins-line-fill" style="width:${(100 * s.remaining) / s.studiedFor}%"></div></div>`;
    if (s.phase === "feedback")
      return `<div class="ins-line"><div id="review-bar" class="ins-line-fill review" style="width:0%"></div></div>`;
    return `<div class="ins-line"></div>`;
  }

  function memoryFooter(s) {
    if (s.phase === "recall") {
      return `<div class="ins-foot">
        <ul class="ins-keys">
          <li><kbd>←</kbd><kbd>→</kbd> Move between boxes</li>
          <li><kbd>Enter</kbd> Next box, then submit</li>
          <li>Units optional</li>
        </ul>
        <button class="ins-btn" type="submit">Submit <kbd>Enter</kbd></button>
      </div>`;
    }
    if (s.phase === "feedback") {
      const r = s.rounds[s.rounds.length - 1];
      const last = s.index + 1 >= s.total;
      return `<div class="ins-foot">
        <p class="ins-note"><b>${r.right} of ${r.targets.length}</b> correct · ${r.seconds.toFixed(1)} s</p>
        <button class="ins-btn" type="button" data-action="memory-next">${last ? "See results" : "Next round"} <kbd>Enter</kbd></button>
      </div>`;
    }
    const note =
      s.phase === "study"
        ? `Memorise all four readings. ${s.targets.length} will be hidden when the line runs out.`
        : `Round ${s.index + 1} of ${s.total} begins shortly.`;
    return `<div class="ins-foot"><p class="ins-note">${note}</p></div>`;
  }

  function memoryCountdown(s) {
    const n = Math.max(1, Math.ceil(s.remaining / (s.readyFor / 3)));
    return `<div class="ins-countdown" aria-hidden="true">
      <span class="ins-countdown-label">Round ${s.index + 1} of ${s.total}</span>
      <span class="ins-countdown-num beat" id="countdown">${n}</span>
    </div>`;
  }

  function memoryAnnouncement(s) {
    if (s.phase === "ready")
      return `Round ${s.index + 1} of ${s.total}. ${MEMORY_LEVELS[s.level].label}.`;
    if (s.phase === "study") return "Memorise the four readings.";
    if (s.phase === "recall")
      return `Values hidden. Enter ${s.targets.map((k) => MEMORY_FIELDS[k].label.toLowerCase()).join(", ")}.`;
    const r = s.rounds[s.rounds.length - 1];
    return `${r.right} of ${r.targets.length} correct.`;
  }

  function flightNumber(k, v) {
    if (k === "altitude") return Number(v).toLocaleString("en-US");
    if (k === "heading") return String(v).padStart(3, "0") + "°";
    return String(v);
  }

  // Per-frame phase driver, called from the tick loop.
  function updateMemory(s, now) {
    const t = (now - s.phaseBegan) / 1000;
    if (s.phase === "ready") {
      s.remaining = Math.max(0, s.readyFor - t);
      const el = document.querySelector("#countdown");
      const n = String(Math.max(1, Math.ceil(s.remaining / (s.readyFor / 3))));
      if (el && el.textContent !== n) {
        el.textContent = n;
        el.classList.remove("beat");
        void el.offsetWidth; // restart the CSS beat animation
        el.classList.add("beat");
      }
      if (s.remaining <= 0) {
        s.phase = "study";
        s.phaseBegan = now;
        s.remaining = s.studiedFor;
        app.refresh();
      }
    } else if (s.phase === "study") {
      s.remaining = Math.max(0, s.studiedFor - t);
      const bar = document.querySelector("#study-bar");
      if (bar) {
        bar.style.width = (100 * s.remaining) / s.studiedFor + "%";
        bar.classList.toggle("caution", s.remaining <= 2);
      }
      if (s.remaining <= 0) {
        s.phase = "recall";
        s.phaseBegan = now;
        s.remaining = 0;
        app.refresh();
      }
    } else if (s.phase === "recall") {
      s.remaining = t;
    } else if (s.phase === "feedback") {
      const bar = document.querySelector("#review-bar");
      if (bar) bar.style.width = Math.min(100, (100 * t) / MEMORY_REVIEW) + "%";
      if (t >= MEMORY_REVIEW) advanceMemory(s);
    }
  }

  function submitMemory(form) {
    const s = state.session;
    if (!s || s.module !== "memory" || s.phase !== "recall") return;

    const data = new FormData(form);
    const answers = {};
    const marks = {};
    let right = 0;
    for (const k of s.targets) {
      answers[k] = String(data.get(k) ?? "").trim();
      marks[k] = gradeFlight(k, answers[k], s.values[k]);
      if (marks[k]) right++;
    }
    const seconds = (performance.now() - s.phaseBegan) / 1000;
    s.roundCorrect += right;
    s.roundTotal += s.targets.length;
    s.seconds.push(seconds);
    s.rounds.push({
      level: s.level,
      targets: s.targets.slice(),
      values: { ...s.values },
      answers,
      marks,
      right,
      seconds,
    });

    s.phase = "feedback";
    s.phaseBegan = performance.now();
    s.remaining = seconds;
    app.refresh();
  }

  // Leaves the feedback phase: next round, or finish with the unchanged scoring rule.
  function advanceMemory(s = state.session) {
    if (!s || s.module !== "memory" || s.phase !== "feedback") return;
    s.index++;
    if (s.index >= s.total) {
      const avg = s.seconds.reduce((a, b) => a + b, 0) / s.seconds.length;
      app.finish(
        gradeSpeed(s.roundCorrect, s.roundTotal, avg, MEMORY_RECALL_REF),
        `${s.roundCorrect} of ${s.roundTotal} readings correct. Average recall time ${avg.toFixed(1)} s.`,
      );
    } else {
      randomMemoryRound(s);
      app.refresh();
    }
  }

  function randomMemoryRound(s) {
    const level =
      s.mode === "assessment" ? MEMORY_RAMP[s.index] || "hard" : s.difficulty;
    s.level = MEMORY_LEVELS[level] ? level : "easy";
    const { study, hide } = MEMORY_LEVELS[s.level];
    s.targets = Object.keys(MEMORY_FIELDS)
      .sort(() => Math.random() - 0.5)
      .slice(0, hide);
    s.values = randomFlight();
    s.studiedFor = study;
    s.readyFor = MEMORY_READY;
    s.remaining = s.readyFor;
    s.phase = "ready";
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
    const raw = String(input ?? "")
      .replace(/[,\s]/g, "")
      .toLowerCase();
    // Strip a unit first, then a single ident letter, so "240kts" is not read as "240kt".
    const clean = raw
      .replace(/(?:ft|kts|kt|deg|mhz|°)$/, "")
      .replace(/[asrh]$/, "");
    return (
      clean !== "" &&
      Number.isFinite(Number(clean)) &&
      Number(clean) === Number(expected)
    );
  }

  // ---- keyboard navigation (recall) ----

  // ← / →: move to the previous / next concealed box (stops at either end).
  function memoryStep(input, dir) {
    const fields = Array.from(
      document.querySelectorAll("[data-memory-field]"),
    );
    const next = fields[fields.indexOf(input) + dir];
    if (!next) return;
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  }

  // Brings focus back to the first empty box (or the first box) when it has drifted away.
  function memoryFocus() {
    const fields = Array.from(
      document.querySelectorAll("[data-memory-field]"),
    );
    (fields.find((f) => f.value.trim() === "") || fields[0])?.focus();
  }

  // Enter: jump to the next empty concealed box; submit once all are filled.
  function memoryEnter(input) {
    const fields = Array.from(
      document.querySelectorAll("[data-memory-field]"),
    );
    const at = fields.indexOf(input);
    const ordered = fields.slice(at + 1).concat(fields.slice(0, at + 1));
    const empty = ordered.find((f) => f.value.trim() === "");
    if (empty && empty !== input) empty.focus();
    else document.querySelector("#memory-answer")?.requestSubmit();
  }

  // ---- results breakdown (complete screen) ----

  function renderBreakdown(s) {
    if (s.module !== "memory" || !s.rounds?.length) return "";
    const avg = s.seconds.reduce((a, b) => a + b, 0) / s.seconds.length;

    const rows = s.rounds
      .map(
        (r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${MEMORY_LEVELS[r.level].label}</td>
        <td><div class="chip-row">${r.targets
          .map(
            (k) =>
              `<span class="param-chip ${r.marks[k] ? "ok" : "miss"}">${MEMORY_FIELDS[k].code} ${r.marks[k] ? "✓" : "✗"}</span>`,
          )
          .join("")}</div></td>
        <td><strong>${r.right} / ${r.targets.length}</strong></td>
        <td>${r.seconds.toFixed(1)} s</td>
      </tr>`,
      )
      .join("");

    const params = Object.keys(MEMORY_FIELDS)
      .map((k) => {
        const asked = s.rounds.filter((r) => r.targets.includes(k));
        const hit = asked.filter((r) => r.marks[k]).length;
        const pct = asked.length ? Math.round((100 * hit) / asked.length) : null;
        const tone = pct === null ? "" : pct >= 60 ? "ok" : "miss";
        return `<div class="param-bar">
          <span class="param-code">${MEMORY_FIELDS[k].code}</span>
          <div class="param-track"><div class="param-fill ${tone}" style="width:${pct ?? 0}%"></div></div>
          <span class="param-val">${pct === null ? "not asked" : `${hit} / ${asked.length}`}</span>
        </div>`;
      })
      .join("");

    const speed = clamp(avg / MEMORY_RECALL_REF, 0, 1);
    return `<div class="result-stats">
      ${resultStat("Readings correct", `${s.roundCorrect} / ${s.roundTotal}`, `${Math.round((100 * s.roundCorrect) / s.roundTotal)}% accuracy · 85% of score`)}
      ${resultStat("Average recall", `${avg.toFixed(1)} s`, `${MEMORY_RECALL_REF} s reference · 15% of score`)}
      ${resultStat("Rounds", s.rounds.length, s.mode === "assessment" ? "Easy → hard ramp" : `${MEMORY_LEVELS[s.level].label} level`)}
    </div>
    <div class="result-grid">
      <section class="result-card">
        <h3 class="result-card-title">Round by round</h3>
        <div class="table-wrap">
          <table class="data-table ins-table">
            <thead><tr><th>#</th><th>Level</th><th>Concealed</th><th>Correct</th><th>Time</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
      <section class="result-card">
        <h3 class="result-card-title">Accuracy by parameter</h3>
        ${params}
        <h3 class="result-card-title" style="margin-top:18px">Recall speed</h3>
        <div class="param-bar">
          <span class="param-code">AVG</span>
          <div class="param-track"><div class="param-fill ${speed < 0.5 ? "ok" : "miss"}" style="width:${(100 * speed).toFixed(0)}%"></div></div>
          <span class="param-val">${avg.toFixed(1)} / ${MEMORY_RECALL_REF} s</span>
        </div>
      </section>
    </div>`;
  }

  function resultStat(title, value, note) {
    return `<div class="result-stat"><span>${escapeHtml(title)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(note)}</small></div>`;
  }

  // ============================================================
  // CONTROL — two-instrument compensatory tracking
  // ============================================================

  function controlView(s) {
    return (
      runHead(
        s,
        "Two stages: centre the dial needle first, then centre the horizontal ball.",
      ) +
      `
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
    </div>`
    );
  }

  function updateControl(s, dt, time, wall) {
    const stage = time < s.duration / 2 ? "needle" : "ball";
    if (stage !== s.stage) {
      s.stage = stage;
      // Do not let a held key from stage 1 control stage 2.
      app.held.clear();
      s.ballX = -0.26;
      s.ballVel = 0;
      s.needleAngle = 0;
      s.needleVel = 0;
    }
    const inNeedle =
      stage === "needle"
        ? (app.held.has("down") ? 1 : 0) - (app.held.has("up") ? 1 : 0)
        : 0;
    const inBall =
      stage === "ball"
        ? (app.held.has("right") ? 1 : 0) - (app.held.has("left") ? 1 : 0)
        : 0;

    const driftNeedle =
      0.55 * Math.sin(time * 0.9 + 1.2) +
      0.3 * Math.sin(time * 2.1 + 0.4) +
      0.15 * Math.sin(time * 4.3);
    const driftBall =
      0.5 * Math.cos(time * 0.85 + 0.6) +
      0.28 * Math.sin(time * 1.9 + 2.1) +
      0.12 * Math.cos(time * 3.7);

    const damping = Math.exp(-2.8 * dt);
    if (stage === "needle")
      s.needleVel =
        (s.needleVel + (driftNeedle + inNeedle * 3.4) * dt) * damping;
    if (stage === "ball")
      s.ballVel = (s.ballVel + (driftBall + inBall * 3.4) * dt) * damping;

    s.needleAngle = clamp(s.needleAngle + s.needleVel * dt, -1.2, 1.2);
    s.ballX = clamp(s.ballX + s.ballVel * dt, -1, 1);

    const needleDev = Math.abs(s.needleAngle) / 1.2;
    const ballDev = Math.abs(s.ballX);
    const deviation = stage === "needle" ? needleDev : ballDev;
    const onTarget = deviation < 0.14;

    const measured = wall > 0.25 ? wall : dt;
    s.measureTime += measured;
    s.deviationArea += deviation * measured;
    if (wall <= 0.25 && onTarget) s.onTarget += dt;

    // live readouts
    const pct = document.querySelector("#control-target");
    const dv = document.querySelector("#control-distance");
    const pr = document.querySelector("#control-presses");
    const st = document.querySelector("#target-status");
    const stageEl = document.querySelector("#control-stage");
    if (stageEl)
      stageEl.textContent =
        stage === "needle" ? "Needle · 1 / 2" : "Ball · 2 / 2";
    if (pct)
      pct.textContent =
        Math.round((100 * s.onTarget) / Math.max(0.001, s.measureTime)) + "%";
    if (dv)
      dv.textContent =
        ((100 * s.deviationArea) / Math.max(0.001, s.measureTime)).toFixed(1) +
        "%";
    if (pr) pr.textContent = s.corrections;
    if (st) {
      st.textContent = onTarget
        ? stage === "needle"
          ? "Needle centred — hold steady"
          : "Ball centred — hold steady"
        : stage === "needle"
          ? "Stage 1 · Use ↑ / ↓ to centre the needle"
          : "Stage 2 · Use ← / → to centre the ball";
      st.className = "status-line " + (onTarget ? "good" : "warn");
    }
  }

  // Theme tokens for canvas drawing, re-read whenever data-theme changes.
  let paletteCache = null;
  function palette() {
    const theme = document.documentElement.dataset.theme || "dark";
    if (paletteCache?.theme === theme) return paletteCache;
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    paletteCache = {
      theme,
      bg: v("--ins-bg"),
      raised: v("--ins-raised"),
      line: v("--ins-line"),
      lineStrong: v("--ins-line-strong"),
      text: v("--ins-text"),
      dim: v("--ins-dim"),
      faint: v("--ins-faint"),
      accent: v("--ins-primary"),
      ok: v("--ins-ok"),
      bad: v("--ins-bad"),
      caution: v("--ins-caution"),
    };
    return paletteCache;
  }

  function drawControl(s) {
    const canvas = document.querySelector("#control-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const p = palette();
    const w = canvas.width,
      h = canvas.height;

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);

    // ---- Round dial ----
    const cx = w / 2,
      cy = 190,
      R = 150;

    // Bezel
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = p.raised;
    ctx.fill();
    ctx.strokeStyle = p.lineStrong;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Face
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = p.bg;
    ctx.fill();

    // Ticks
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
      const long = i % 3 === 0;
      const r1 = long ? R * 0.82 : R * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98);
      ctx.strokeStyle = long ? p.dim : p.faint;
      ctx.lineWidth = long ? 2 : 1;
      ctx.stroke();
    }

    // Tolerance arc + target mark
    ctx.lineCap = "butt";
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.95, -Math.PI / 2 - 0.14, -Math.PI / 2 + 0.14);
    ctx.strokeStyle = p.bad;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.95, -Math.PI / 2 - 0.09, -Math.PI / 2 + 0.09);
    ctx.strokeStyle = p.bad;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Needle
    const na = -Math.PI / 2 + s.needleAngle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * R * 0.88, cy + Math.sin(na) * R * 0.88);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();

    // Hub
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fillStyle = p.bg;
    ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = p.dim;
    ctx.font = '600 11px "Segoe UI", -apple-system, Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(
      s.stage === "needle"
        ? "STAGE 1 · ACTIVE NEEDLE  (↑ / ↓)"
        : "STAGE 1 · COMPLETED",
      cx,
      cy - R - 14,
    );

    // ---- Rectangle bar ----
    const bx = 80,
      bw = w - 160,
      by = 400,
      bh = 56;

    ctx.fillStyle = p.raised;
    ctx.fillRect(bx - 10, by - 10, bw + 20, bh + 20);
    ctx.strokeStyle = p.lineStrong;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 10.5, by - 10.5, bw + 21, bh + 21);
    ctx.fillStyle = p.bg;
    ctx.fillRect(bx, by, bw, bh);

    for (let i = 0; i <= 20; i++) {
      const tx = bx + (i / 20) * bw;
      const tall = i % 5 === 0;
      ctx.beginPath();
      ctx.moveTo(tx, by + bh - 4);
      ctx.lineTo(tx, by + bh - (tall ? 16 : 8));
      ctx.strokeStyle = tall ? p.dim : p.faint;
      ctx.lineWidth = tall ? 2 : 1;
      ctx.stroke();
    }

    const centreX = bx + bw / 2;
    ctx.lineCap = "butt";
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.moveTo(centreX, by);
    ctx.lineTo(centreX, by + bh);
    ctx.strokeStyle = p.bad;
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(centreX, by);
    ctx.lineTo(centreX, by + bh);
    ctx.strokeStyle = p.bad;
    ctx.lineWidth = 3;
    ctx.stroke();

    const ballX = centreX + s.ballX * (bw / 2 - 16);
    ctx.beginPath();
    ctx.arc(ballX, by + bh / 2, 12, 0, Math.PI * 2);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.strokeStyle = p.bg;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = p.dim;
    ctx.fillText(
      s.stage === "ball" ? "STAGE 2 · ACTIVE BALL  (← / →)" : "STAGE 2 · NEXT",
      cx,
      by + bh + 19,
    );
    // Visually distinguish the inactive instrument without hiding the reference.
    ctx.fillStyle = p.bg;
    ctx.globalAlpha = 0.55;
    if (s.stage === "needle") ctx.fillRect(bx - 16, by - 16, bw + 32, bh + 32);
    else ctx.fillRect(cx - R - 10, cy - R - 10, 2 * R + 20, 2 * R + 20);
    ctx.globalAlpha = 1;
  }

  function finishControl() {
    const s = state.session;
    if (!s || s.module !== "control") return;
    const duration = Math.max(0.001, s.measureTime);
    const on = (100 * s.onTarget) / duration;
    const dev = clamp(s.deviationArea / duration, 0, 1);
    const score = Math.round(0.7 * on + 30 * (1 - dev));
    app.finish(
      score,
      `Two sequential stages completed · ${Math.round(on)}% time on target · mean deviation ${Math.round(dev * 100)}% · ${s.corrections} corrections.`,
      {
        timeOnTarget: Math.round(on),
        meanDeviation: Math.round(dev * 100),
        corrections: s.corrections,
      },
    );
  }

  // ============================================================
  // MATHEMATICS
  // ============================================================

  function mathView(s) {
    return (
      runHead(s, "Read each question and enter only the numeric answer.") +
      `
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
    </div>`
    );
  }

  function submitMath(form) {
    const s = state.session;
    if (!s || s.module !== "maths") return;
    const raw = String(new FormData(form).get("answer") ?? "").trim();
    if (raw !== "" && Number(raw) === s.question.answer) s.correct++;
    s.seconds.push((performance.now() - s.questionStarted) / 1000);
    s.index++;

    if (s.index >= s.total) {
      const avg = s.seconds.reduce((a, b) => a + b, 0) / s.seconds.length;
      app.finish(
        gradeSpeed(s.correct, s.total, avg, 30),
        `${s.correct} of ${s.total} correct · average answer time ${avg.toFixed(1)} s.`,
      );
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
      const speed = rand(7, 22) * 10,
        hrs = rand(2, 5);
      answer = speed;
      prompt = `An aircraft flies ${speed * hrs} km in ${hrs} hours. What is its average speed in km/h?`;
    } else if (type === 1) {
      const rate = rand(7, 18) * 10,
        hrs = rand(2, 4);
      answer = rate * hrs;
      prompt = `An aircraft uses ${rate} litres of fuel per hour. How many litres will it use in ${hrs} hours?`;
    } else if (type === 2) {
      const speed = rand(8, 25) * 10,
        hrs = rand(2, 4);
      answer = speed * hrs;
      prompt = `An aircraft flies at ${speed} km/h for ${hrs} hours. How many kilometres does it travel?`;
    } else if (type === 3) {
      const speed = rand(8, 22) * 10,
        hrs = rand(2, 5);
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
    return (
      runHead(s, "Steer left or right to pass through each gap.") +
      `
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
        <p class="small muted">Speed and obstacles increase gradually. Avoid amber hazard markers while steering through gates.</p>
        <div class="keycaps" style="margin-top:14px"><span>Left: ${escapeHtml(visibleKey(state.keys.left))}</span><span>Right: ${escapeHtml(visibleKey(state.keys.right))}</span></div>

      </div>
    </div>`
    );
  }

  function updateSlalom(s, dt) {
    const side =
      (app.held.has("right") ? 1 : 0) - (app.held.has("left") ? 1 : 0);
    s.x = clamp(s.x + side * 1.65 * dt, -0.92, 0.92);
    // Increase speed by up to 110% over a scored run; later runs begin slightly faster.
    s.speedFactor = 1 + 0.75 * (s.elapsed / s.duration) + 0.16 * s.run;
    const travelSpeed = 112 * s.speedFactor;
    s.nextGate -= dt;
    if (s.nextGate <= 0) {
      s.gates.push({
        y: -20,
        centre: Math.sin((s.elapsed + 1) * 0.94) * 0.53,
        done: false,
      });
      s.nextGate += Math.max(
        0.83,
        1.85 - (s.elapsed / s.duration) * 0.65 - s.run * 0.12,
      );
    }
    // New hazards are independent of gate pairs and become more frequent over time.
    s.nextHazard -= dt;
    if (s.nextHazard <= 0) {
      const side = Math.sin(s.elapsed * 2.3) > 0 ? 1 : -1;
      s.hazards.push({
        y: -24,
        x: side * (0.35 + 0.16 * Math.sin(s.elapsed)),
        done: false,
      });
      s.nextHazard += Math.max(
        2.1,
        5.9 - 3 * (s.elapsed / s.duration) - 0.35 * s.run,
      );
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
    s.gates = s.gates.filter((g) => g.y < 480);
    for (const hazard of s.hazards) {
      hazard.y += travelSpeed * dt;
      if (!hazard.done && hazard.y >= 368) {
        hazard.done = true;
        s.obstacleCount++;
        if (Math.abs(s.x - hazard.x) > 0.17) s.obstacleAvoided++;
      }
    }
    s.hazards = s.hazards.filter((h) => h.y < 490);
    const sp = document.querySelector("#slalom-speed");
    const av = document.querySelector("#slalom-avoid");
    if (sp) sp.textContent = s.speedFactor.toFixed(1) + "×";
    if (av) av.textContent = s.obstacleAvoided + " / " + s.obstacleCount;

    const gc = document.querySelector("#gate-count");
    const gh = document.querySelector("#gate-hit");
    if (gc) gc.textContent = s.totalGates;
    if (gh) gh.textContent = s.hits;
  }

  function drawSlalom(s) {
    const canvas = document.querySelector("#slalom-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const p = palette();
    const w = canvas.width,
      h = canvas.height;

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = p.line;
    ctx.lineWidth = 1;
    for (let x = 40; x < w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 25; y < h; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Gates: port (left) red, starboard (right) green, like navigation lights.
    const cx = w / 2;
    for (const g of s.gates) {
      const middle = cx + g.centre * 215;
      ctx.beginPath();
      ctx.arc(middle - 58, g.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = p.bad;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(middle + 58, g.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = p.ok;
      ctx.fill();
    }

    for (const hz of s.hazards) {
      const hx = cx + hz.x * 215;
      ctx.beginPath();
      ctx.moveTo(hx, hz.y - 13);
      ctx.lineTo(hx + 13, hz.y + 10);
      ctx.lineTo(hx - 13, hz.y + 10);
      ctx.closePath();
      ctx.fillStyle = p.caution;
      ctx.fill();
      ctx.fillStyle = p.bg;
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("!", hx, hz.y + 7);
    }
    const px = cx + s.x * 215,
      py = 368;
    ctx.fillStyle = p.accent;
    ctx.strokeStyle = p.bg;
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
    if (!s || s.module !== "slalom") return;
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
    app.finish(
      score,
      `${s.totalRuns} run(s) completed · average score ${Math.round(score)} / 100.`,
    );
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
    return (
      runHead(
        s,
        "Identify the aircraft that matches all three instrument readings.",
      ) +
      `
    <div class="panel">
      <h3 class="panel-title">Instrument readings</h3>
      <div class="orientation-instruments">
        <div><small>RBI</small><strong>${q.bearing}°</strong></div>
        <div><small>Artificial horizon</small><strong>${q.pitch > 0 ? "+" : ""}${q.pitch}°</strong></div>
        <div><small>Compass</small><strong>${String(q.head).padStart(3, "0")}°</strong></div>
      </div>
      <h3 style="margin-bottom:10px">Which aircraft matches?</h3>
      <div class="aircraft-options">
        ${q.options
          .map(
            (o, i) => `
          <button class="aircraft-option" data-choice="${i}">
            <span class="num">${i + 1}</span>
            ${planeSvg(o.heading)}
            <span>Heading ${String(o.heading).padStart(3, "0")}°<br><small>Pitch ${o.pitch > 0 ? "+" : ""}${o.pitch}° · Bearing ${o.bearing}°</small></span>
          </button>`,
          )
          .join("")}
      </div>
      <p class="small muted" style="margin-top:12px">Tip: press 1, 2, 3 or 4 on the keyboard.</p>
    </div>`
    );
  }

  function submitOrientation(choice) {
    const s = state.session;
    if (!s || s.module !== "orientation" || s.phase === "complete") return;
    if (Number(choice) === s.question.correct) s.correct++;
    s.index++;
    if (s.index >= s.total) {
      app.finish(
        (s.correct / s.total) * 100,
        `${s.correct} of ${s.total} correct. Incorrect answers were not penalised.`,
      );
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
      else
        options.push({
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
    return (
      runHead(
        s,
        "Copy the new autopilot values and acknowledge every warning.",
      ) +
      `
    <div class="workspace">
      <div class="instrument-panel">
        <h3 class="panel-title">New autopilot values</h3>
        <div class="task-grid">
          <div><span>Altitude</span><strong>${s.target.altitude.toLocaleString()} ft</strong></div>
          <div><span>Heading</span><strong>${String(s.target.heading).padStart(3, "0")}°</strong></div>
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
        <div class="alert-box ${s.alertActive ? "active" : ""}" id="alert-status">
          ${s.alertActive ? "● WARNING — PRESS " + escapeHtml(visibleKey(state.keys.alert)) : "No active warnings"}
        </div>
        <button class="btn secondary" data-action="ack" style="margin-top:10px">Acknowledge (${escapeHtml(visibleKey(state.keys.alert))})</button>
        <p class="small muted" style="margin-top:10px">Cleared: <strong id="task-alerts">${s.alertsCorrect} / ${s.alerts}</strong></p>
      </div>
    </div>`
    );
  }

  function submitTask(form) {
    const s = state.session;
    if (!s || s.module !== "task") return;
    const data = new FormData(form);
    const num = (v) => Number(String(v ?? "").replace(/[,\s]/g, ""));
    s.applied++;
    if (
      num(data.get("altitude")) === s.target.altitude &&
      num(data.get("heading")) === s.target.heading &&
      num(data.get("speed")) === s.target.speed
    )
      s.appliedCorrect++;
    s.target = newTaskValues();
    app.refresh();
  }

  function clearAlert() {
    const s = state.session;
    if (!s || s.module !== "task" || !s.alertActive) return;
    s.alertActive = false;
    s.alertsCorrect++;
    s.reactionSum += (performance.now() - s.alertStarted) / 1000;
    updateTaskUI(s);
  }

  function updateTaskUI(s) {
    const status = document.querySelector("#alert-status");
    if (status) {
      status.textContent = s.alertActive
        ? "● WARNING — PRESS " + visibleKey(state.keys.alert)
        : "No active warnings";
      status.classList.toggle("active", s.alertActive);
    }
    const c = document.querySelector("#task-count");
    const a = document.querySelector("#task-alerts");
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
    if (!s || s.module !== "task") return;
    const acc = s.applied ? (100 * s.appliedCorrect) / s.applied : 0;
    const ack = s.alerts ? (100 * s.alertsCorrect) / s.alerts : 100;
    const speed = s.alertsCorrect
      ? 100 * clamp(1 - s.reactionSum / s.alertsCorrect / 5, 0, 1)
      : 0;
    app.finish(
      0.55 * acc + 0.3 * ack + 0.15 * speed,
      `${s.appliedCorrect} / ${s.applied} values copied · ${s.alertsCorrect} / ${s.alerts} alerts cleared.`,
    );
  }

  function newTaskValues() {
    return {
      altitude: rand(4, 32) * 1000,
      heading: rand(0, 35) * 10,
      speed: rand(14, 35) * 10,
    };
  }

  // ---- shared helpers ----

  function gradeSpeed(correct, total, avgSeconds, allowed = 30) {
    if (!total) return 0;
    const accuracy = correct / total;
    const speed = clamp(1 - avgSeconds / allowed, 0, 1);
    return Math.round(100 * (0.85 * accuracy + 0.15 * speed));
  }

  function visibleKey(k) {
    if (k.startsWith("Arrow")) return k.replace("Arrow", "");
    if (k === "Space") return "Space";
    if (k.startsWith("Key")) return k.slice(3);
    return k;
  }

  return {
    renderAssessment,
    renderBreakdown,
    syncHud,
    updateMemory,
    submitMemory,
    advanceMemory,
    randomMemoryRound,
    memoryStep,
    memoryFocus,
    memoryEnter,
    gradeFlight,
    controlView,
    updateControl,
    drawControl,
    finishControl,
    mathView,
    submitMath,
    slalomView,
    updateSlalom,
    drawSlalom,
    slalomNext,
    resetSlalom,
    orientationView,
    submitOrientation,
    taskView,
    submitTask,
    clearAlert,
    updateTaskAlerts,
    finishTask,
    gradeSpeed,
  };
})();
