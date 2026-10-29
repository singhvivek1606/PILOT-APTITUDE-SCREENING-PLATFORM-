// Browser-ready: works even when index.html is opened directly (file://).
window.AVScreens = (() => {
  "use strict";
  // ============================================================
  // screens.js — non-test page renderers (pure HTML strings)
  // ============================================================

  const { MODULES, MEMORY_LEVELS, MEMORY_RAMP, state } = window.AVCore;
  const {
    escapeHtml,
    ring,
    heroGauge,
    memoryPreview,
    controlPreview,
    slalomPreview,
    orientationPreview,
    mathsPreview,
    taskPreview,
    scoreChart,
  } = window.AVUI;
  function renderHome() {
    if (!state.candidate)
      return `<section class="welcome-screen">
    <div class="welcome-main">
      <div class="eyebrow">AVIATION APTITUDE · CANDIDATE INTRODUCTION</div>
      <h1>Welcome to <span>AeroVector</span></h1>
      <p>Test the skills used in pilot training: memory, control, maths and more. Start by entering your name, then complete your candidate details.</p>
      <form id="welcome-form" class="welcome-form">
        <label class="field-label" for="welcome-name">Your first name</label>
        <div class="welcome-field"><input id="welcome-name" class="field" name="first" required maxlength="60" autocomplete="given-name" placeholder="Enter your first name" autofocus>
        <button type="submit" class="btn primary lg">Continue →</button></div>
      </form>
      <div class="welcome-foot"><span>01 · Introduce yourself</span><span>02 · Registration</span></div>
    </div>
    <div class="welcome-visual"><div class="welcome-instrument">${heroGauge()}</div>
      <strong>6 aviation aptitude modules</strong><small>Keyboard operated · Local results</small></div>
  </section>`;
    const records = scored();
    const avg = mean(records);
    const best = records.length
      ? Math.max(...records.map((r) => +r.score))
      : null;

    return (
      pageHead(
        "Pilot aptitude / Overview",
        `Welcome${state.candidate?.first ? ", " + escapeHtml(state.candidate.first) : ""}`,
        "A professional-grade screening battery modelled on the COMPASS™ assessment format.",
        `<div class="page-actions"><button class="btn secondary" data-page="register">Edit details</button></div>`,
      ) +
      `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow">Assessment Platform</div>
        <h2>Build confidence.<br><span>Measure your aviation skills.</span></h2>
        <p>Complete six interactive aviation tests. Take a short practice trial, then choose a scored assessment. Your results remain on this device.</p>
        <div class="hero-cta">
          <button class="btn primary lg" data-page="tests">Choose an assessment</button>
        </div>
      </div>
      <div class="hero-instrument">
        ${heroGauge()}
        <span class="hero-label">HEADING INDICATOR · SAMPLE</span>
      </div>
    </section>

    ${sectionHead("Session summary", "Local device only")}
    <div class="metrics">
      ${metric("Scored assessments", records.length, "Completed")}
      ${metric("Average score", avg === null ? "—" : avg + "%", "Across attempts")}
      ${metric("Best score", best === null ? "—" : best + "%", "Highest recorded")}
      ${metric("Modules available", "6", "Full suite")}
    </div>

    ${sectionHead("Assessment modules", "Select a module")}
    <div class="module-grid">${Object.keys(MODULES).map(moduleCard).join("")}</div>

    ${sectionHead("Getting started", "Two steps")}
    <div class="panel">
      <ol class="briefing-steps">
        <li>Enter your name and save it on this device.</li>
        <li>Review the module briefing and complete the <strong>scored assessment</strong> — results save automatically.</li>
      </ol>
    </div>`
    );
  }

  function renderTests() {
    return (
      pageHead(
        "Training / Assessments",
        "Choose your assessment",
        "Select a module, read the instructions and choose Practice or Scored Assessment. Scored results appear in Results and History.",
      ) +
      `<div class="module-grid">${Object.keys(MODULES).map(moduleCard).join("")}</div>`
    );
  }

  function renderResults() {
    const records = scored();
    const avg = mean(records);
    const best = records.length
      ? Math.max(...records.map((r) => +r.score))
      : null;

    return (
      pageHead(
        "Results / Analytics",
        "Results & analytics",
        "Performance is derived only from scored attempts.",
      ) +
      `
    <div class="metrics">
      ${metric("Scored assessments", records.length, "Completed")}
      ${metric("Average score", avg === null ? "—" : avg + "%", "All attempts")}
      ${metric("Best score", best === null ? "—" : best + "%", "Highest")}
      ${metric("Modules tried", new Set(records.map((r) => r.module)).size + " / 6", "Distinct modules")}
    </div>

    <div class="panel" style="margin-top:16px"><div class="info-row"><span><strong>Result guide</strong></span><strong>PASS: 60–100% · NEEDS PRACTICE: 0–59%</strong></div>
    <p class="small muted" style="margin:8px 0 0">The 60% threshold is a training-demo rule, not an official aviation qualification standard. Practice trials do not count toward results.</p></div>
    ${sectionHead("Latest scored attempts", "Saved in this browser")}
    <div class="panel">${
      records.length
        ? `<table class="data-table"><thead><tr><th>Module</th><th>Candidate</th><th>Date</th><th>Score</th><th>Result</th></tr></thead><tbody>${records
            .slice(0, 6)
            .map(
              (r) =>
                `<tr><td>${escapeHtml(MODULES[r.module].name)}</td><td>${escapeHtml(r.candidate || "—")}</td><td>${new Date(r.date).toLocaleString()}</td><td><strong>${Math.round(r.score)}%</strong></td><td>${statusChip(r.score)}</td></tr>`,
            )
            .join("")}</tbody></table>`
        : `<div class="empty"><h3>No scored results yet</h3><p>Choose a module, select Scored Assessment and complete it. Practice attempts are not stored.</p><button class="btn primary" data-page="tests">Choose an assessment</button></div>`
    }</div>
    ${sectionHead("Score trend", "Last eight attempts")}
    <div class="panel">
      ${
        records.length
          ? scoreChart(records)
          : `<div class="empty"><h3>No scored results yet</h3><p>Complete a scored assessment to populate analytics.</p><button class="btn primary" data-page="tests">Begin assessment</button></div>`
      }
    </div>

    ${sectionHead("Per-module averages", "Best and average")}
    <div class="panel">
      ${Object.entries(MODULES)
        .map(([id, m]) => {
          const rows = records.filter((r) => r.module === id);
          const a = mean(rows);
          return `<div class="info-row"><span>${escapeHtml(m.name)}</span><strong>${a === null ? "—" : a + "%"}${rows.length ? ` <span class="small muted">· best ${Math.max(...rows.map((r) => r.score))}%</span>` : ""}</strong></div>`;
        })
        .join("")}
    </div>`
    );
  }

  function renderHistory() {
    const records = scored();
    return (
      pageHead(
        "Results / History",
        "Assessment history",
        "Scored attempts only. Practice sessions are not stored.",
        `<div class="page-actions"><button class="btn secondary" data-action="export">Export JSON</button></div>`,
      ) +
      `<section class="panel">${
        records.length
          ? `<table class="data-table">
        <thead><tr><th>Date</th><th>Candidate</th><th>Module</th><th>Score</th><th>Result</th><th>Details</th></tr></thead>
        <tbody>${records
          .map(
            (r) => `
          <tr>
            <td>${new Date(r.date).toLocaleString()}</td>
            <td>${escapeHtml(r.candidate || "—")}</td>
            <td>${escapeHtml(MODULES[r.module].name)}</td>
            <td><strong>${Math.round(r.score)} / 100</strong></td>
            <td>${statusChip(r.score)}</td>
            <td>${escapeHtml(r.details || "Completed")}</td>
          </tr>`,
          )
          .join("")}</tbody>
      </table>`
          : `<div class="empty"><h3>No history yet</h3><p>Complete a scored assessment to record it here.</p><button class="btn primary" data-page="tests">Begin assessment</button></div>`
      }
  </section>`
    );
  }

  function renderRegister() {
    const firstName = escapeHtml(state.candidate?.first || "");
    return (
      pageHead(
        "Candidate / Registration",
        "Collect candidate details before the assessment begins",
        "Fields include company, personal details, address, contact information and demographics.",
      ) +
      `
      <div class="registration-toolbar">
        <div></div>
        <button type="button" class="btn secondary" data-demo="registration">Load demo data</button>
      </div>
      <div class="panel">
        <form id="candidate-form" class="form-grid">
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="candidate-company">Company / Institute</label>
              <input id="candidate-company" class="field" name="company" value="${escapeHtml(state.candidate?.company || "")}" maxlength="120" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="candidate-first">First name</label>
              <input id="candidate-first" class="field" name="first" value="${firstName}" maxlength="60" required>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="candidate-last">Last name</label>
              <input id="candidate-last" class="field" name="last" value="${escapeHtml(state.candidate?.last || "")}" maxlength="60" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="candidate-address">Address</label>
              <input id="candidate-address" class="field" name="address" value="${escapeHtml(state.candidate?.address || "")}" maxlength="180" required>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="candidate-zipcode">Zip code</label>
              <input id="candidate-zipcode" class="field" name="zipcode" value="${escapeHtml(state.candidate?.zipcode || "")}" maxlength="20" required>
            </div>
            <div class="field-group">
              <label class="field-label" for="candidate-place">Place</label>
              <input id="candidate-place" class="field" name="place" value="${escapeHtml(state.candidate?.place || "")}" maxlength="80" required>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="candidate-country">Country</label>
              <select id="candidate-country" class="field" name="country" required>
                <option value="">Select country</option>
                <option value="United Kingdom" ${state.candidate?.country === "United Kingdom" ? "selected" : ""}>United Kingdom</option>
                <option value="United States" ${state.candidate?.country === "United States" ? "selected" : ""}>United States</option>
                <option value="Germany" ${state.candidate?.country === "Germany" ? "selected" : ""}>Germany</option>
                <option value="India" ${state.candidate?.country === "India" ? "selected" : ""}>India</option>
                <option value="Canada" ${state.candidate?.country === "Canada" ? "selected" : ""}>Canada</option>
                <option value="Australia" ${state.candidate?.country === "Australia" ? "selected" : ""}>Australia</option>
                <option value="France" ${state.candidate?.country === "France" ? "selected" : ""}>France</option>
                <option value="Other" ${state.candidate?.country === "Other" ? "selected" : ""}>Other</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="candidate-birthdate">Birth date</label>
              <input id="candidate-birthdate" class="field" name="birthdate" value="${escapeHtml(state.candidate?.birthdate || "")}" type="date" required>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group">
              <label class="field-label" for="candidate-gender">Gender</label>
              <select id="candidate-gender" class="field" name="gender" required>
                <option value="">Select gender</option>
                <option value="Female" ${state.candidate?.gender === "Female" ? "selected" : ""}>Female</option>
                <option value="Male" ${state.candidate?.gender === "Male" ? "selected" : ""}>Male</option>
                <option value="Non-binary" ${state.candidate?.gender === "Non-binary" ? "selected" : ""}>Non-binary</option>
                <option value="Prefer not to say" ${state.candidate?.gender === "Prefer not to say" ? "selected" : ""}>Prefer not to say</option>
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="candidate-phone">Telephone</label>
              <input id="candidate-phone" class="field" name="telephone" value="${escapeHtml(state.candidate?.telephone || "")}" maxlength="30" inputmode="tel" required>
            </div>
          </div>
          <div class="field-row">
            <div class="field-group" style="width:100%;">
              <label class="field-label" for="candidate-email">E-mail</label>
              <input id="candidate-email" class="field" name="email" value="${escapeHtml(state.candidate?.email || "")}" type="email" maxlength="120" required>
            </div>
          </div>
          <div class="form-actions" style="grid-column:1/-1;">
            <button type="button" class="btn secondary" data-page="home">Back</button>
            <button type="submit" class="btn primary" id="candidate-submit" disabled>Continue</button>
          </div>
        </form>
      </div>`
    );
  }

  function renderSettings() {
    const rows = ["left", "right", "up", "down", "alert"]
      .map((k) => {
        const label = {
          left: "Move left",
          right: "Move right",
          up: "Move up",
          down: "Move down",
          alert: "Acknowledge alert",
        }[k];
        return `<div class="info-row">
      <span>${label}</span>
      <button class="btn secondary" data-bind="${k}">${escapeHtml(visibleKey(state.keys[k]))}</button>
    </div>`;
      })
      .join("");

    return (
      pageHead(
        "Controls / Keyboard",
        "Keyboard bindings",
        "All assessments are operable entirely from the keyboard.",
      ) +
      `
    <div class="panel">
      <h3 class="panel-title">Active bindings</h3>
      ${rows}
      <p class="small muted" style="margin-top:12px">${state.capture ? `Press a new key for <strong>${escapeHtml(state.capture)}</strong>…` : "Click a binding to reassign it."}</p>
      <div class="form-actions">
        <button class="btn secondary" data-action="reset-keys">Restore defaults</button>
      </div>
    </div>
    <div class="panel">
      <h3 class="panel-title">Default layout</h3>
      <p class="muted">Control and Slalom can be operated with the Arrow keys or with the WASD cluster. Space acknowledges alerts in Task Manager.</p>
      <div class="keycaps">
        <span>←</span><span>↑</span><span>↓</span><span>→</span>
        <span>W</span><span>A</span><span>S</span><span>D</span><span>Space</span>
      </div>
    </div>`
    );
  }

  function renderModuleIntro(id) {
    const m = MODULES[id];
    const sel = state.selection[id];

    const guides = {
      memory: [
        "After a 3-2-1 countdown, four flight parameters are displayed for a fixed memorisation period.",
        "One or more values are then concealed. Type the missing readings; use ← → to move between boxes and Enter to continue.",
        "Each round ends with a short review. Suffixes such as <code>240s</code> or plain numbers are both accepted.",
      ],
      control: [
        "The test has two stages: first the round needle, then the horizontal ball.",
        "Use Up/Down during the needle stage; Left/Right during the ball stage.",
        "Only one instrument is active at a time. Centre it on its red mark.",
      ],
      maths: [
        "Read each question and type only the numeric answer — no units.",
        "Answers are validated against the expected value.",
        "Both accuracy and response time contribute to your score.",
      ],
      slalom: [
        "Steer the aircraft left and right through the red and green gates.",
        "The gates become faster and more frequent as the run progresses. Avoid amber hazard markers.",
        "Three scored runs of 90 seconds each; use Practice first if needed.",
      ],
      orientation: [
        "Three flight instruments are displayed: RBI, artificial horizon, compass.",
        "Choose which of four aircraft symbols matches all three readings.",
        "Wrong answers are not penalised — answer as many as possible.",
      ],
      task: [
        "Copy new altitude, heading and speed values into the autopilot settings.",
        "When a warning alert appears, acknowledge it with the Space key.",
        "Both tasks contribute to the composite score.",
      ],
    };

    const preview = {
      memory: memoryPreview(),
      control: controlPreview(),
      slalom: slalomPreview(),
      orientation: orientationPreview(),
      maths: mathsPreview(),
      task: taskPreview(),
    }[id];

    const inputs = {
      memory: "Keyboard · ← → · Enter",
      control: "Arrow keys (rebindable)",
      maths: "Keyboard",
      slalom: "Left / Right keys",
      orientation: "Keys 1–4 or click",
      task: "Keyboard + alert key",
    };

    return `
    <div class="briefing-top">
      <button class="btn secondary" data-page="home">← Back</button>
      <span class="crumb">Assessment ${m.marker} · Pre-flight briefing</span>
    </div>
    <div class="briefing">
      <div class="briefing-visual">
        <div class="cockpit-display">
          <div class="cockpit-display-screen">${preview}</div>
          <div class="cockpit-display-caption"><span>Sample display</span><span>${escapeHtml(m.kind)}</span></div>
        </div>
        <dl class="briefing-specs">
          <div><dt>Format</dt><dd>${escapeHtml(m.time)}</dd></div>
          <div><dt>Skill</dt><dd>${escapeHtml(m.kind)}</dd></div>
          <div><dt>Input</dt><dd>${escapeHtml(inputs[id])}</dd></div>
        </dl>
      </div>
      <div class="briefing-instructions">
        <div>
          <div class="eyebrow">Module ${m.marker}</div>
          <h1>${escapeHtml(m.name)}</h1>
          <p class="muted">${escapeHtml(m.desc)}</p>
        </div>
        <div>
          <div class="field-label">Procedure</div>
          <ol class="briefing-steps">${guides[id].map((s) => `<li><span>${s}</span></li>`).join("")}</ol>
        </div>
        <div>
          <div class="field-label">Mode</div>
          <div class="mode-picker">
            <button class="mode-option ${sel.mode === "practice" ? "selected" : ""}" data-mode="practice" data-for="${id}">
              <b>Practice</b><small>Unscored · repeat as needed</small>
            </button>
            <button class="mode-option ${sel.mode === "assessment" ? "selected" : ""}" data-mode="assessment" data-for="${id}">
              <b>Scored assessment</b><small>Result saved to history</small>
            </button>
          </div>
        </div>
        ${id === "memory" ? memoryLevelPicker(sel) : ""}
      </div>
    </div>
    <div class="bottom-bar">
      <span class="bottom-bar-text">${sel.mode === "assessment" ? "Scored result will be saved in Results and History" : "Practice only · results are not stored"}<span class="bottom-bar-hint"> · press <kbd>Enter</kbd> to start</span></span>
      <button class="btn" data-action="start" data-module="${id}">Start ${sel.mode === "assessment" ? "scored assessment" : "practice"} →</button>
    </div>`;
  }

  // Practice picks a level; scored runs always ramp easy → hard (MEMORY_RAMP).
  function memoryLevelPicker(sel) {
    if (sel.mode === "assessment") {
      return `<div>
        <div class="field-label">Difficulty ramp</div>
        <div class="ramp">${MEMORY_RAMP.map(
          (lv, i) =>
            `<span class="ramp-step ${lv}"><small>R${i + 1}</small>${MEMORY_LEVELS[lv].label}</span>`,
        ).join("")}</div>
        <p class="small muted" style="margin-top:8px">Scored runs step from easy to hard automatically.</p>
      </div>`;
    }
    return `<div>
      <div class="field-label" id="difficulty-label">Memorisation level</div>
      <div class="seg" role="radiogroup" aria-labelledby="difficulty-label">
        ${Object.entries(MEMORY_LEVELS)
          .map(
            ([key, lv]) => `<label class="seg-opt">
          <input type="radio" name="difficulty" value="${key}" ${sel.difficulty === key ? "checked" : ""}>
          <span><b>${lv.label}</b><small>${lv.study} s · ${lv.hide} hidden</small></span>
        </label>`,
          )
          .join("")}
      </div>
    </div>`;
  }

  function renderComplete(s) {
    const scored = s.mode === "assessment";
    const tone = !scored ? "practice" : Number(s.score) >= 60 ? "pass" : "fail";
    const breakdown = window.AVAssess?.renderBreakdown?.(s) || "";
    // .ins-done-<module> lets css/instrument.css theme a module's results with its test.
    return `<div class="ins-done ins-done-${s.module}">
    <section class="result-hero ${tone}">
      <div class="result-ring" style="--score:${s.score}">
        ${ring(s.score / 100, {
          size: 168,
          stroke: 10,
          cls: "score-ring",
          inner: `<span class="score-num" aria-hidden="true"></span><small>/ 100</small><span class="sr-only">${s.score} out of 100</span>`,
        })}
      </div>
      <div class="result-copy">
        <div class="eyebrow">${scored ? "Scored result · saved to this device" : "Practice result · not saved"}</div>
        <h1>${escapeHtml(MODULES[s.module].name)} ${scored ? "assessment" : "practice"} complete</h1>
        ${scored ? statusChip(s.score) : '<span class="result-status practice">PRACTICE</span>'}
        <p class="result-details">${escapeHtml(s.details)}</p>
        <p class="small muted">Training prototype. The 60% PASS mark is a demo rule, not an official pilot selection standard.</p>
        <div class="form-actions">
          <button class="btn secondary" data-go="${s.module}">Run again</button>
          <button class="btn primary" data-page="${scored ? "results" : "tests"}">${scored ? "View saved results" : "Choose a scored assessment"} →</button>
        </div>
      </div>
    </section>
    ${breakdown}</div>`;
  }

  // --- helpers ---

  function pageHead(crumb, title, desc, actions = "") {
    return `<div class="page-head">
    <div>
      <div class="crumb">${escapeHtml(crumb)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(desc)}</p>
    </div>
    ${actions}
  </div>`;
  }

  function sectionHead(title, note = "") {
    return `<div class="section-head"><h2>${escapeHtml(title)}</h2><span>${escapeHtml(note)}</span></div>`;
  }

  function metric(title, value, note) {
    return `<div class="metric"><span>${escapeHtml(title)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(note)}</small></div>`;
  }

  function moduleCard(id) {
    const m = MODULES[id];
    const previews = {
      memory: memoryPreview,
      control: controlPreview,
      slalom: slalomPreview,
      orientation: orientationPreview,
      maths: mathsPreview,
      task: taskPreview,
    };
    return `<article class="module-card">
    <div class="module-card-head">
      <span class="eyebrow">Module ${m.marker}</span>
      <span class="module-tag">${escapeHtml(m.kind)}</span>
    </div>
    <h3>${escapeHtml(m.name)}</h3>
    <p>${escapeHtml(m.desc)}</p>
    <div class="module-preview">${previews[id]()}</div>
    <div class="module-actions">
      <button class="btn primary" data-go="${id}">Open assessment →</button>
    </div>
  </article>`;
  }

  function statusChip(score) {
    const pass = Number(score) >= 60;
    return `<span class="result-status ${pass ? "pass" : "fail"}">${pass ? "PASS" : "NEEDS PRACTICE"}</span>`;
  }

  function scored() {
    return state.history.filter(
      (r) =>
        r &&
        MODULES[r.module] &&
        r.mode === "assessment" &&
        Number.isFinite(Number(r.score)),
    );
  }

  function mean(rows) {
    return rows.length
      ? Math.round(rows.reduce((n, r) => n + Number(r.score), 0) / rows.length)
      : null;
  }

  function visibleKey(k) {
    if (k.startsWith("Arrow")) return k.replace("Arrow", "");
    if (k === "Space") return "Space";
    if (k.startsWith("Key")) return k.slice(3);
    return k;
  }

  return {
    renderHome,
    renderTests,
    renderResults,
    renderHistory,
    renderRegister,
    renderSettings,
    renderModuleIntro,
    renderComplete,
    scored,
  };
})();
