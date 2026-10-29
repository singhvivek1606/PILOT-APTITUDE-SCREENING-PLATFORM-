// Browser-ready: works even when index.html is opened directly (file://).
(() => {
  "use strict";
  // ============================================================
  // app.js — entry point, router, session lifecycle, tick loop
  // ============================================================

  const {
    MODULES,
    DEFAULT_KEYS,
    STORAGE_KEYS,
    state,
    app,
    write,
    validKeys,
  } = window.AVCore;
  const { clamp, pad, fmtTime, toast } = window.AVUI;
  const screens = window.AVScreens;
  const assess = window.AVAssess;
  // expose held keys + helpers to assessments
  app.held = new Set();
  app.finish = finish;
  app.restartLoop = () => {
    last = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const appEl = $("#app");
  const navEl = $("#nav");
  const headerStatus = $("#headerStatus");

  let raf = 0;
  let last = 0;

  // ============================================================
  // ROUTER
  // ============================================================

  function route(page, fromHash = false) {
    const valid =
      ["home", "register", "tests", "results", "history", "settings"].includes(
        page,
      ) || MODULES[page];
    if (!valid) page = "home";

    if (!leavePage(page)) {
      if (location.hash !== "#" + state.page)
        history.replaceState(null, "", "#" + state.page);
      return;
    }

    if (state.session?.phase === "complete" && page !== state.page)
      state.session = null;
    state.page = page;

    if (!fromHash && location.hash !== "#" + page)
      history.pushState(null, "", "#" + page);
    render();
    window.scrollTo(0, 0);
  }

  function leavePage(next) {
    // Any phase except "complete" is live (Memory uses ready/study/recall/feedback).
    if (
      state.session &&
      state.session.phase !== "complete" &&
      next !== state.page
    ) {
      if (
        state.session.mode === "assessment" &&
        !confirm("Leave the scored assessment? The attempt will not be saved.")
      ) {
        return false;
      }
      stop();
      state.session = null;
    }
    return true;
  }

  // ============================================================
  // RENDER
  // ============================================================

  function render() {
    const page = state.page;
    const s = state.session;
    let html;

    if (s && s.module === page && s.phase !== "complete") {
      html = assess.renderAssessment(s);
      if (html === null) html = screens.renderComplete(s);
    } else if (s && s.module === page && s.phase === "complete") {
      html = screens.renderComplete(s);
    } else {
      switch (page) {
        case "home":
          html = screens.renderHome();
          break;
        case "register":
          html = screens.renderRegister();
          break;
        case "tests":
          html = screens.renderTests(false);
          break;
        case "results":
          html = screens.renderResults();
          break;
        case "history":
          html = screens.renderHistory();
          break;
        case "settings":
          html = screens.renderSettings();
          break;
        default:
          html = MODULES[page]
            ? screens.renderModuleIntro(page)
            : screens.renderHome();
      }
    }

    appEl.innerHTML = html;

    const hasCandidate = !!(
      state.candidate && String(state.candidate.first || "").trim()
    );
    navEl.style.display = hasCandidate ? "" : "none";
    const navToggle = $("#navToggle");
    if (navToggle) navToggle.style.display = hasCandidate ? "" : "none";
    if (!hasCandidate) {
      navEl.classList.remove("open");
      if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    }

    // Bind primary start buttons directly (fallback for click delegation)
    $$('[data-action="start"]', appEl).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          startSession(btn.dataset.module || state.page);
        } catch (err) {
          reportStartError(err);
        }
      });
    });

    // Update nav
    $$("#nav [data-page]").forEach((el) => {
      const active =
        el.dataset.page === page ||
        (s && s.module === page && el.dataset.page === "tests");
      el.classList.toggle("active", active);
      if (active) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });

    // Update header status
    if (s && s.module === page) {
      headerStatus.innerHTML = `<span class="module-tab">${MODULES[s.module].name}</span>`;
    } else if (MODULES[page]) {
      headerStatus.innerHTML = `<span class="module-tab">${MODULES[page].name}</span>`;
    } else {
      headerStatus.innerHTML = `<span class="status-pill"><span class="status-dot"></span>${state.candidate?.first ? escapeText(state.candidate.first) : "Not registered"}</span>`;
    }

    // Draw canvas immediately on first paint
    if (s && s.module === page && s.phase === "running") {
      if (s.module === "control") assess.drawControl(s);
      if (s.module === "slalom") assess.drawSlalom(s);
    }

    if (page === "register") {
      setTimeout(() => setupRegistrationForm(), 0);
    }

    if (page === "home" && !state.candidate) $("#welcome-name")?.focus();
    // Focus first input if applicable
    if (s && ["maths", "task"].includes(s.module)) {
      const inp = $("main input", appEl);
      if (inp) inp.focus();
    }
    if (s && s.module === page && s.module === "memory" && s.phase === "recall")
      $("[data-memory-field]", appEl)?.focus();
  }

  function escapeText(v) {
    return String(v).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  app.refresh = render;

  // ============================================================
  // SESSION LIFECYCLE
  // ============================================================

  function startSession(id) {
    if (!MODULES[id] || !state.selection[id]) {
      toast("Select a module first.");
      return;
    }

    const cfg = state.selection[id];
    if (cfg.mode === "assessment" && !state.candidate) {
      toast("Enter your name before a scored assessment.");
      route("home");
      return;
    }

    stop();

    const s = {
      module: id,
      mode: cfg.mode,
      phase: "running",
      index: 0,
      correct: 0,
      total: 0,
      seconds: [],
      startedAt: performance.now(),
      duration: 0,
      remaining: 0,
      score: 0,
    };

    if (id === "memory") {
      s.total = cfg.mode === "assessment" ? 5 : 2;
      s.difficulty = cfg.difficulty;
      s.roundCorrect = 0;
      s.roundTotal = 0;
      s.rounds = [];
      assess.randomMemoryRound(s);
    }
    if (id === "maths") {
      s.total = cfg.mode === "assessment" ? 8 : 3;
      s.duration = cfg.mode === "assessment" ? 240 : 90;
      s.remaining = s.duration;
      s.question = makeMathQuestion();
      s.questionStarted = performance.now();
    }
    if (id === "control") {
      s.duration = cfg.mode === "assessment" ? 60 : 20;
      s.stage = "needle";
      s.remaining = s.duration;
      s.needleAngle = 0.35;
      s.needleVel = 0;
      s.ballX = -0.25;
      s.ballVel = 0;
      s.onTarget = 0;
      s.deviationArea = 0;
      s.measureTime = 0;
      s.corrections = 0;
    }
    if (id === "slalom") {
      s.run = 0;
      s.totalRuns = cfg.mode === "assessment" ? 3 : 1;
      s.duration = cfg.mode === "assessment" ? 90 : 30;
      s.remaining = s.duration;
      s.runResults = [];
      assess.resetSlalom(s);
    }
    if (id === "orientation") {
      s.total = cfg.mode === "assessment" ? 12 : 4;
      s.duration = cfg.mode === "assessment" ? 600 : 120;
      s.remaining = s.duration;
      s.question = makeOrientationQuestion();
    }
    if (id === "task") {
      s.duration = cfg.mode === "assessment" ? 60 : 30;
      s.remaining = s.duration;
      s.target = { altitude: 12000, heading: 270, speed: 240 };
      s.applied = 0;
      s.appliedCorrect = 0;
      s.alerts = 0;
      s.alertsCorrect = 0;
      s.alertActive = false;
      s.alertStarted = 0;
      s.reactionSum = 0;
    }

    state.session = s;
    render();
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    app.held.clear();
  }

  function finish(score, details, extra = {}) {
    const s = state.session;
    if (!s || s.phase === "complete") return;
    stop();
    s.phase = "complete";
    s.score = clamp(Math.round(score), 0, 100);
    s.details = details;

    if (s.mode === "assessment") {
      const record = {
        id: "AV-" + Date.now(),
        date: new Date().toISOString(),
        module: s.module,
        mode: s.mode,
        score: s.score,
        details,
        candidate: state.candidate?.first || "",
        ...extra,
      };
      state.history.unshift(record);
      state.history = state.history.slice(0, 300);
      if (!write(STORAGE_KEYS.history, state.history))
        toast("Result shown but browser storage is unavailable.");
    }
    render();
  }

  function reportStartError(err) {
    console.error("AeroVector: failed to start session", err);
    toast("Could not start: " + (err?.message || "unknown error"));
  }

  // ============================================================
  // TICK LOOP
  // ============================================================

  function tick(now) {
    const s = state.session;
    if (!s || s.phase === "complete") return;

    const wall = last ? Math.max(0, (now - last) / 1000) : 0;
    const dt = clamp(wall, 0, 0.05);
    last = now;

    if (s.module === "memory") {
      assess.updateMemory(s, now);
    } else if (s.module === "slalom") {
      s.elapsed = (now - s.runStart) / 1000;
      s.remaining = Math.max(0, s.duration - s.elapsed);
      assess.updateSlalom(s, dt);
      assess.drawSlalom(s);
      if (s.remaining <= 0) {
        assess.slalomNext();
        if (state.session?.phase !== "complete")
          raf = requestAnimationFrame(tick);
        return;
      }
    } else {
      s.remaining = Math.max(0, s.duration - (now - s.startedAt) / 1000);
      if (s.module === "control") {
        assess.updateControl(s, dt, (now - s.startedAt) / 1000, wall);
        assess.drawControl(s);
      }
      if (s.module === "task") assess.updateTaskAlerts(s, now);

      if (s.remaining <= 0) {
        if (s.module === "maths") {
          const avg = s.seconds.length
            ? s.seconds.reduce((a, b) => a + b, 0) / s.seconds.length
            : 30;
          finish(
            assess.gradeSpeed(s.correct, s.total, avg, 30),
            `Time expired · ${s.correct} / ${s.total} correct.`,
          );
        } else if (s.module === "control") {
          assess.finishControl();
        } else if (s.module === "orientation") {
          finish(
            (s.correct / s.total) * 100,
            `${s.correct} / ${s.total} correct (time expired).`,
          );
        } else if (s.module === "task") {
          assess.finishTask();
        }
        return;
      }
    }

    const timer = document.querySelector("#timer");
    if (timer) timer.textContent = fmtTime(s.remaining);
    assess.syncHud(s);

    raf = requestAnimationFrame(tick);
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function normalizedKey(e) {
    if (e.code === "Space" || e.key === " ") return "Space";
    return e.code || e.key;
  }

  function defaultKeysActive() {
    return ["up", "down", "left", "right", "alert"].every(
      (k) => state.keys[k] === DEFAULT_KEYS[k],
    );
  }

  function directionsFor(code) {
    const out = [];
    for (const dir of ["up", "down", "left", "right"]) {
      if (state.keys[dir] === code) out.push(dir);
    }
    if (defaultKeysActive()) {
      const alias = { KeyA: "left", KeyD: "right", KeyW: "up", KeyS: "down" };
      if (alias[code]) out.push(alias[code]);
    }
    return out;
  }

  function keyDown(e) {
    if (state.capture) {
      e.preventDefault();
      const key = normalizedKey(e);
      const target = state.capture;
      state.capture = null;
      if (
        !/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Key[A-Z])$/.test(key)
      ) {
        toast("Choose an arrow key, a letter or Space.");
        render();
        return;
      }
      const updated = { ...state.keys, [target]: key };
      if (!validKeys(updated)) {
        toast("That key is already in use.");
        render();
        return;
      }
      state.keys = updated;
      write(STORAGE_KEYS.keys, updated);
      render();
      toast("Binding updated.");
      return;
    }

    // Enter-to-advance in candidate form
    if (
      state.page === "register" &&
      e.key === "Enter" &&
      e.target.matches("#candidate-form input, #candidate-form select")
    ) {
      e.preventDefault();
      const controls = $$("#candidate-form input, #candidate-form select");
      const i = controls.indexOf(e.target);
      const next = controls[i + 1];
      if (next) next.focus();
      else $('#candidate-form button[type="submit"]')?.focus();
      return;
    }

    // Enter on a module briefing starts it (focused buttons/links/fields keep their own Enter).
    if (
      e.key === "Enter" &&
      !e.repeat &&
      MODULES[state.page] &&
      state.session?.module !== state.page &&
      !e.target.closest?.("input, select, textarea, button, a")
    ) {
      e.preventDefault();
      try {
        startSession(state.page);
      } catch (err) {
        reportStartError(err);
      }
      return;
    }

    const s = state.session;
    if (!s || s.phase === "complete" || s.module !== state.page) return;

    if (s.module === "memory") {
      const inField =
        s.phase === "recall" && e.target.matches("[data-memory-field]");
      // Physical arrow keys only: rebound letter keys must stay typeable (e.g. the "a" ident).
      const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      const plain = !e.altKey && !e.metaKey && !e.ctrlKey;
      if (
        s.phase === "recall" &&
        !inField &&
        plain &&
        !e.target.closest("#memory-answer button") &&
        (e.key.length === 1 || e.key === "Enter" || step)
      ) {
        // Focus drifted (e.g. after cancelling the leave dialog): pull it back into a box.
        // A typed character then lands in that box; Enter/arrows only refocus.
        if (e.key.length !== 1) e.preventDefault();
        assess.memoryFocus();
      } else if (inField && e.key === "Enter") {
        e.preventDefault();
        assess.memoryEnter(e.target);
      } else if (inField && step && plain && !e.shiftKey) {
        e.preventDefault();
        assess.memoryStep(e.target, step);
      } else if (
        s.phase === "feedback" &&
        !e.repeat &&
        (e.key === "Enter" || normalizedKey(e) === "Space")
      ) {
        e.preventDefault();
        assess.advanceMemory();
      }
      return;
    }

    if (s.module === "orientation" && /^[1-4]$/.test(e.key) && !e.repeat) {
      e.preventDefault();
      assess.submitOrientation(Number(e.key) - 1);
      return;
    }

    if (s.module === "task" && normalizedKey(e) === state.keys.alert) {
      e.preventDefault();
      if (!e.repeat) assess.clearAlert();
      return;
    }

    if (!["control", "slalom"].includes(s.module)) return;
    if (e.target.matches("input, textarea, select")) return;

    const dirs = directionsFor(normalizedKey(e));
    const mapped = dirs.filter(
      (d) => s.module === "control" || d === "left" || d === "right",
    );
    if (mapped.length) {
      e.preventDefault();
      for (const d of mapped) {
        if (
          !app.held.has(d) &&
          s.module === "control" &&
          !e.repeat &&
          ((s.stage === "needle" && (d === "up" || d === "down")) ||
            (s.stage === "ball" && (d === "left" || d === "right")))
        )
          s.corrections++;
        app.held.add(d);
      }
    }
  }

  function keyUp(e) {
    for (const d of directionsFor(normalizedKey(e))) app.held.delete(d);
  }

  function click(e) {
    const quick = e.target.closest("[data-quickstart]");
    if (quick) {
      e.preventDefault();
      try {
        const id = quick.dataset.quickstart;
        if (!MODULES[id]) throw new Error("Invalid module");
        state.selection[id].mode = "practice";
        if (!leavePage(id)) return;
        state.page = id;
        history.pushState(null, "", "#" + id);
        startSession(id);
        window.scrollTo(0, 0);
      } catch (err) {
        reportStartError(err);
      }
      return;
    }

    const page = e.target.closest("[data-page]");
    if (page) {
      e.preventDefault();
      route(page.dataset.page);
      navEl.classList.remove("open");
      $("#navToggle").setAttribute("aria-expanded", "false");
      return;
    }

    const go = e.target.closest("[data-go]");
    if (go) {
      if (state.session?.phase === "complete") state.session = null;
      route(go.dataset.go);
      return;
    }

    const mode = e.target.closest("[data-mode]");
    if (mode) {
      state.selection[mode.dataset.for].mode = mode.dataset.mode;
      render();
      return;
    }

    const bind = e.target.closest("[data-bind]");
    if (bind) {
      state.capture = bind.dataset.bind;
      render();
      toast("Press a new key for " + bind.dataset.bind);
      return;
    }

    const choice = e.target.closest("[data-choice]");
    if (choice) {
      if (state.session?.module === "orientation")
        assess.submitOrientation(Number(choice.dataset.choice));
      return;
    }

    const action = e.target.closest("[data-action]");
    if (action) {
      switch (action.dataset.action) {
        case "start":
          e.preventDefault();
          try {
            startSession(action.dataset.module || state.page);
          } catch (err) {
            reportStartError(err);
          }
          break;
        case "stop":
          if (state.session) {
            stop();
            state.session = null;
            render();
            toast("Session stopped.");
          }
          break;
        case "back":
          if (state.session) {
            if (state.session.mode === "assessment") {
              if (
                !confirm(
                  "Leave this assessment? The current score will not be saved.",
                )
              ) {
                return;
              }
            }
            stop();
            state.session = null;
            route("home");
          }
          break;
        case "ack":
          assess.clearAlert();
          break;
        case "memory-next":
          assess.advanceMemory();
          break;
        case "export":
          exportResults();
          break;
        case "reset-keys":
          state.keys = { ...DEFAULT_KEYS };
          write(STORAGE_KEYS.keys, state.keys);
          render();
          toast("Default bindings restored.");
          break;
      }
      return;
    }

    const demo = e.target.closest("[data-demo]");
    if (demo) {
      e.preventDefault();
      if (demo.dataset.demo === "registration") {
        const demoData = {
          company: "Northwind Aviation",
          first: state.candidate?.first || "Alex",
          last: "Morgan",
          address: "18 Runway Lane",
          zipcode: "SW1A 1AA",
          place: "London",
          country: "United Kingdom",
          birthdate: "1994-02-14",
          gender: "Male",
          telephone: "+44 20 7946 0958",
          email: "alex.morgan@northwindaviation.com",
        };
        state.candidate = { ...state.candidate, ...demoData };
        write(STORAGE_KEYS.candidate, state.candidate);
        render();
        toast("Demo registration data loaded.");
        return;
      }

      const name =
        demo.dataset.demo === "candidate" ? "Alex Morgan" : "Demo User";
      state.candidate = { first: name };
      write(STORAGE_KEYS.candidate, state.candidate);

      const sampleResults = [
        {
          module: "memory",
          score: 80,
          mode: "assessment",
          candidate: name,
          date: new Date(Date.now() - 86400000).toISOString(),
          details: "Demo memory assessment complete.",
        },
        {
          module: "control",
          score: 72,
          mode: "assessment",
          candidate: name,
          date: new Date(Date.now() - 172800000).toISOString(),
          details: "Demo control assessment complete.",
        },
        {
          module: "maths",
          score: 88,
          mode: "assessment",
          candidate: name,
          date: new Date(Date.now() - 259200000).toISOString(),
          details: "Demo maths assessment complete.",
        },
        {
          module: "slalom",
          score: 74,
          mode: "assessment",
          candidate: name,
          date: new Date(Date.now() - 345600000).toISOString(),
          details: "Demo slalom assessment complete.",
        },
      ];

      const existing = Array.isArray(state.history) ? state.history : [];
      state.history = [...sampleResults, ...existing].slice(0, 300);
      write(STORAGE_KEYS.history, state.history);
      toast("Demo candidate and sample results loaded.");
      route("home");
      return;
    }
  }

  function submit(e) {
    const form = e.target;
    if (
      ![
        "welcome-form",
        "candidate-form",
        "memory-answer",
        "math-answer",
        "task-answer",
      ].includes(form.id)
    )
      return;
    e.preventDefault();
    if (!form.reportValidity()) return;

    if (form.id === "welcome-form") {
      const first = String(new FormData(form).get("first") || "").trim();
      if (!first) return;
      state.candidate = { first };
      state.welcomeName = null;
      write(STORAGE_KEYS.candidate, state.candidate);
      toast("Name saved on this device.");
      route("register");
      return;
    }
    if (form.id === "candidate-form") {
      const c = Object.fromEntries(new FormData(form));
      const name = String(c.first || "").trim();
      if (!name) {
        toast("Enter your full name to continue.");
        return;
      }
      state.candidate = { ...state.candidate, ...c, first: name };
      state.welcomeName = null;
      write(STORAGE_KEYS.candidate, state.candidate);
      toast("Candidate details saved.");
      route("home");
      return;
    }
    if (form.id === "memory-answer") assess.submitMemory(form);
    if (form.id === "math-answer") assess.submitMath(form);
    if (form.id === "task-answer") assess.submitTask(form);
  }

  function change(e) {
    if (e.target.name === "difficulty" && MODULES[state.page]) {
      state.selection[state.page].difficulty = e.target.value;
    }
  }

  function exportResults() {
    const rows = screens.scored();
    if (!rows.length) {
      toast("No scored results to export.");
      return;
    }
    const data = JSON.stringify(
      {
        application: "AeroVector Pilot Aptitude Screening Platform",
        exportedAt: new Date().toISOString(),
        candidate: state.candidate,
        results: rows,
      },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aerovector-results.json";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function applyTheme() {
    const isDark = state.theme === "dark";
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light",
    );
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.textContent = isDark ? "Light mode" : "Dark mode";
      toggle.setAttribute("aria-pressed", String(isDark));
    }
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    write(STORAGE_KEYS.theme, state.theme);
    applyTheme();
  }

  // UTC (Zulu) clock in the header — the time reference pilots use.
  function startUtcClock() {
    const el = document.getElementById("utcClock");
    if (!el) return;
    const tick = () => {
      const d = new Date();
      el.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
      el.dateTime = d.toISOString();
    };
    tick();
    setInterval(tick, 1000);
  }

  function bindThemeToggle() {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      toggleTheme();
    });
  }

  // simple wrappers because assessments.js can't import maths/orientation generators
  function makeMathQuestion() {
    // Delegate to a tiny reimplementation via assessment module's exposed helper
    return mathsQuestionFactory();
  }
  function makeOrientationQuestion() {
    return orientationQuestionFactory();
  }

  // These are defined as small standalone factories below so app.js owns session creation.
  function mathsQuestionFactory() {
    const { rand } = {
      rand: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
    };
    const type = rand(0, 4);
    if (type === 0) {
      const s = rand(7, 22) * 10,
        h = rand(2, 5);
      return {
        prompt: `An aircraft flies ${s * h} km in ${h} hours. What is its average speed in km/h?`,
        answer: s,
      };
    }
    if (type === 1) {
      const r = rand(7, 18) * 10,
        h = rand(2, 4);
      return {
        prompt: `An aircraft uses ${r} litres of fuel per hour. How many litres will it use in ${h} hours?`,
        answer: r * h,
      };
    }
    if (type === 2) {
      const s = rand(8, 25) * 10,
        h = rand(2, 4);
      return {
        prompt: `An aircraft flies at ${s} km/h for ${h} hours. How many kilometres does it travel?`,
        answer: s * h,
      };
    }
    if (type === 3) {
      const s = rand(8, 22) * 10,
        h = rand(2, 5);
      return {
        prompt: `A flight is ${s * h} km long. At ${s} km/h, how many hours does it take?`,
        answer: h,
      };
    }
    const d = rand(6, 25) * 10;
    return {
      prompt: `An aircraft travels ${d} km in 30 minutes. What is its average speed in km/h?`,
      answer: d * 2,
    };
  }
  function orientationQuestionFactory() {
    const heads = [0, 45, 90, 135, 180, 225, 270, 315];
    const pitches = [-10, -5, 0, 5, 10];
    const bearings = [0, 90, 180, 270];
    const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    const head = heads[r(0, 7)],
      pitch = pitches[r(0, 4)],
      bearing = bearings[r(0, 3)],
      correct = r(0, 3);
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
  // BOOT
  // ============================================================

  document.addEventListener("click", click);
  document.addEventListener("submit", submit);
  document.addEventListener("change", change);  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", () => app.held.clear());
  window.addEventListener("hashchange", () => {
    const next = location.hash.slice(1) || "home";
    route(next, true);
  });

  $("#navToggle").addEventListener("click", () => {
    const open = navEl.classList.toggle("open");
    $("#navToggle").setAttribute("aria-expanded", String(open));
  });

  applyTheme();
  bindThemeToggle();
  startUtcClock();

  const startPage = location.hash.slice(1) || "home";
  route(startPage, true);

  function validateRegistrationForm() {
    const form = document.getElementById("candidate-form");
    if (!form) return;
    const submit = document.getElementById("candidate-submit");
    if (!submit) return;

    const required = form.querySelectorAll("input[required], select[required]");
    let valid = true;
    required.forEach((field) => {
      const value = String(field.value || "").trim();
      if (!value) {
        valid = false;
      }
    });

    submit.disabled = !valid;
  }

  function setupRegistrationForm() {
    const form = document.getElementById("candidate-form");
    if (!form) return;

    const fields = Array.from(form.querySelectorAll("input, select"));
    fields.forEach((field, idx) => {
      field.addEventListener("input", validateRegistrationForm);
      field.addEventListener("change", validateRegistrationForm);
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const next = fields[idx + 1];
          if (next) next.focus();
          else {
            const submit = document.getElementById("candidate-submit");
            if (submit && !submit.disabled) submit.click();
          }
        }
      });
    });

    validateRegistrationForm();
  }

  setupRegistrationForm();
})();
