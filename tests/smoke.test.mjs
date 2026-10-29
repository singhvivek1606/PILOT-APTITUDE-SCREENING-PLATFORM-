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
