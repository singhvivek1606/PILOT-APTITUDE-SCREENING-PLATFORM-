import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const fetch=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=fetch('index.html'),frontend=fetch('frontend.js'),runtime=fetch('assessment-runtime.mjs');
test('HTML keeps light/dark theme selector and all application entrypoints',()=>{
 assert.match(html,/data-theme-choice="light"/);
 assert.match(html,/data-theme-choice="dark"/);
 assert.match(html,/assessment\.css/);
 assert.match(html,/frontend\.js/);
 assert.match(html,/data-route="registration"/);
 assert.match(html,/data-route="settings"/);
});
test('frontend connects real assessment controller to all six routes',()=>{
 for(const route of ['memory','control','mathematics','slalom','orientation','taskmanager']){
  assert.ok(frontend.includes("'"+route+"'"),route);
 }
 assert.match(frontend,/createAssessmentRuntime/);
 assert.match(frontend,/assessmentRuntime\.mount/);
 assert.match(frontend,/assessmentRuntime\.handleSubmit/);
 assert.match(frontend,/assessmentRuntime\.handleKeyDown/);
});
test('assessments require registration for scored mode and keep practice unscored',()=>{
 assert.match(runtime,/mode==='assessment'&&!candidate/);
 assert.match(runtime,/if\(s\.mode==='assessment'\)saveRecord\(s\.record\)/);
 assert.match(runtime,/candidate-form/);
});
test('tracking uses animation frames and configurable keyboard bindings',()=>{
 assert.match(runtime,/requestAnimationFrame/);
 assert.match(runtime,/cancelAnimationFrame/);
 assert.match(runtime,/validateBindings/);
});
test('browser data stays in local storage without external network requests',()=>{
 assert.match(runtime,/localStorage/);
 assert.doesNotMatch(runtime,/fetch\s*\(|XMLHttpRequest|WebSocket/);
});
