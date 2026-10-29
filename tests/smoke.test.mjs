import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadBrowserModule(path, shared) {
  vm.runInNewContext(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), shared, { filename: path });
}

test('six aptitude modules and default keyboard shortcuts are present', () => {
  const db = new Map();
  const ctx = {
    window: {},
    localStorage: {
      getItem: k => db.get(k) ?? null,
      setItem: (k, v) => db.set(k, v),
    },
  };
  loadBrowserModule('js/core.js', ctx);
  const core = ctx.window.AVCore;
  assert.equal(Object.keys(core.MODULES).length, 6);
  assert.deepEqual(Object.keys(core.MODULES).sort(), ['control','maths','memory','orientation','slalom','task']);
  assert.equal(core.validKeys(core.DEFAULT_KEYS), true);
  assert.equal(core.validKeys({...core.DEFAULT_KEYS, down: 'ArrowUp'}), false);
  assert.equal(core.write('test.persistence', { score: 85 }), true);
  assert.equal(core.read('test.persistence', null).score, 85);
});

test('shared UI utilities escape markup and format time', () => {
  const ctx = { window: {} };
  loadBrowserModule('js/ui.js', ctx);
  const ui = ctx.window.AVUI;
  assert.equal(ui.escapeHtml('<script>&"'), '&lt;script&gt;&amp;&quot;');
  assert.equal(ui.fmtTime(60), '01:00');
  assert.equal(ui.fmtTime(12.1), '00:13');
  assert.equal(ui.clamp(120, 0, 100), 100);
});

function loadAssessment() {
  const db = new Map();
  const clock = { t: 0 };
  const ctx = {
    window: {},
    localStorage: { getItem: k => db.get(k) ?? null, setItem: (k, v) => db.set(k, v) },
    performance: { now: () => clock.t },
    // Minimal FormData over a plain { name: value } object.
    FormData: class { constructor(f) { this.f = f; } get(k) { return this.f[k] ?? null; } },
  };
  for (const f of ['js/core.js', 'js/ui.js', 'js/assessment.js']) loadBrowserModule(f, ctx);
  return { core: ctx.window.AVCore, assess: ctx.window.AVAssess, clock };
}

test('memory grading accepts plain values, idents and units', () => {
  const { assess } = loadAssessment();
  const g = assess.gradeFlight;
  assert.equal(g('speed', '240', 240), true);
  assert.equal(g('speed', '240s', 240), true);
  assert.equal(g('speed', '240 kts', 240), true);
  assert.equal(g('altitude', '12,400 ft', 12400), true);
  assert.equal(g('radio', '121.50 MHz', '121.50'), true);
  assert.equal(g('heading', '087°', 87), true);
  assert.equal(g('heading', '', 87), false);
  assert.equal(g('speed', '241', 240), false);
});

test('memory rounds conceal 1/2/4 readings and scored runs ramp easy to hard', () => {
  const { core, assess } = loadAssessment();
  for (const [level, hide] of [['easy', 1], ['medium', 2], ['hard', 4]]) {
    const s = { mode: 'practice', difficulty: level, index: 0 };
    assess.randomMemoryRound(s);
    assert.equal(s.phase, 'ready');
    assert.equal(s.targets.length, hide);
    assert.equal(s.studiedFor, core.MEMORY_LEVELS[level].study);
  }
  const levels = core.MEMORY_RAMP.map((_, index) => {
    const s = { mode: 'assessment', difficulty: 'easy', index };
    assess.randomMemoryRound(s);
    return s.level;
  });
  assert.deepEqual([...levels], ['easy', 'medium', 'medium', 'hard', 'hard']);
});

test('scored memory run keeps the original scoring formula', () => {
  const { core, assess, clock } = loadAssessment();
  let result = null;
  core.app.refresh = () => {};
  core.app.finish = (score, details) => { result = { score, details }; };
  const s = { module: 'memory', mode: 'assessment', difficulty: 'easy', index: 0, total: 5,
    seconds: [], roundCorrect: 0, roundTotal: 0, rounds: [] };
  core.state.session = s;
  assess.randomMemoryRound(s);

  for (let round = 0; round < s.total; round++) {
    s.phase = 'recall';
    s.phaseBegan = clock.t;
    clock.t += 4000; // 4 s recall each round
    // Answer every concealed reading correctly except the first one in round 1.
    const answers = Object.fromEntries(s.targets.map(k => [k, String(s.values[k])]));
    if (round === 0) answers[s.targets[0]] = 'wrong';
    assess.submitMemory(answers);
    assert.equal(s.phase, 'feedback');
    assess.advanceMemory(s);
  }

  // 1 + 2 + 2 + 4 + 4 = 13 readings, one wrong.
  assert.equal(s.rounds.length, 5);
  assert.equal(s.roundTotal, 13);
  assert.equal(s.roundCorrect, 12);
  assert.equal(result.score, assess.gradeSpeed(12, 13, 4, 22));
  assert.equal(result.details, '12 of 13 readings correct. Average recall time 4.0 s.');
});
