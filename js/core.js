// Browser-ready: works even when index.html is opened directly (file://).
window.AVCore = (() => {
  "use strict";
  // ============================================================
  // core.js — constants, storage, shared mutable state
  // ============================================================

  const STORAGE_KEYS = {
    candidate: "aerovector.candidate",
    history: "aerovector.history",
    keys: "aerovector.keys",
    theme: "aerovector.theme",
  };

  const DEFAULT_KEYS = {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    alert: "Space",
  };

  const MODULES = {
    memory: {
      name: "Memory",
      marker: "01",
      kind: "Short-term recall",
      desc: "Memorise four flight parameters, then recall the ones that disappear.",
      time: "5 rounds",
    },
    control: {
      name: "Control",
      marker: "02",
      kind: "Compensatory tracking",
      desc: "Track the dial needle, then the horizontal ball — one active instrument at a time.",
      time: "60 s scored · 20 s practice",
    },
    maths: {
      name: "Mathematics",
      marker: "03",
      kind: "Applied mental math",
      desc: "Solve aviation arithmetic questions — speed, distance, time, fuel.",
      time: "8 questions",
    },
    slalom: {
      name: "Slalom",
      marker: "04",
      kind: "Path tracking",
      desc: "Steer through increasingly fast gates and avoid extra obstacles.",
      time: "3 × 90 s scored",
    },
    orientation: {
      name: "Orientation",
      marker: "05",
      kind: "Instrument interpretation",
      desc: "Read RBI, artificial horizon and compass; identify the matching aircraft.",
      time: "10 min timed",
    },
    task: {
      name: "Task Manager",
      marker: "06",
      kind: "Dual-task management",
      desc: "Copy new autopilot values while clearing warning alerts as they appear.",
      time: "60 s scored · 30 s practice",
    },
  };

  // Memory levels: study window (s) and how many of the four readings are concealed.
  // Scored runs ignore the selection and ramp through MEMORY_RAMP instead.
  const MEMORY_LEVELS = {
    easy: { label: "Easy", study: 8, hide: 1 },
    medium: { label: "Medium", study: 6, hide: 2 },
    hard: { label: "Hard", study: 5, hide: 4 },
  };
  const MEMORY_RAMP = ["easy", "medium", "medium", "hard", "hard"];

  // Shared mutable state — mutated by screens/assessments via import
  const memoryStore = {};

  const state = {
    page: "home",
    candidate: read(STORAGE_KEYS.candidate, null),
    history: read(STORAGE_KEYS.history, []),
    keys: validKeys(read(STORAGE_KEYS.keys, null))
      ? read(STORAGE_KEYS.keys, null)
      : { ...DEFAULT_KEYS },
    selection: {},
    session: null,
    capture: null,
    theme: read(STORAGE_KEYS.theme, "dark"),
  };

  if (!Array.isArray(state.history)) state.history = [];
  for (const id of Object.keys(MODULES)) {
    state.selection[id] = { mode: "assessment", difficulty: "easy" };
  }

  // `app.refresh()` is set by app.js — allows screens/assessments to trigger re-render.
  const app = { refresh: () => {} };

  // --- storage ---

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? (memoryStore[key] ?? fallback) : JSON.parse(raw);
    } catch {
      return memoryStore[key] ?? fallback;
    }
  }

  function write(key, value) {
    memoryStore[key] = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  // --- key validation ---

  function validKeys(v) {
    if (!v || typeof v !== "object") return false;
    const names = ["up", "down", "left", "right", "alert"].map((k) => v[k]);
    return (
      names.every(
        (x) =>
          typeof x === "string" &&
          /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Key[A-Z])$/.test(x),
      ) && new Set(names).size === names.length
    );
  }

  return {
    STORAGE_KEYS,
    DEFAULT_KEYS,
    MODULES,
    MEMORY_LEVELS,
    MEMORY_RAMP,
    state,
    app,
    read,
    write,
    validKeys,
  };
})();
