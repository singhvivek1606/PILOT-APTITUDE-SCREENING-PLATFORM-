import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../frontend.js', import.meta.url), 'utf8');

function createApp(existingHistory = []) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, innerHTML:'', textContent:'', hidden:false, style:{},
      dataset:{},
      classList:{add(){}, remove(){}, contains(){return false}, toggle(){}},
      setAttribute(){}, addEventListener(){}, focus(){}, querySelector(){return null}
    });
    return elements.get(id);
  }
  const location = { hash:'' };
  const history = {
    pushState(_a,_b,hash){location.hash = hash},
    replaceState(_a,_b,hash){location.hash = hash}
  };
  const document = { documentElement:{dataset:{}}, getElementById:element, querySelectorAll(){return []}, addEventListener(){} };
  const storage = new Map([['aerovector.v1.history', JSON.stringify(existingHistory)]]);
  const localStorage = { getItem:key=>storage.get(key)??null, setItem:(k,v)=>storage.set(k,v) };
  const window = { location, history, scrollTo(){}, addEventListener(){} };
  const context = {document,window,localStorage,location,history,setTimeout(){return 1},clearTimeout(){},console};
  runInNewContext(source, context);
  return {element,storage,context,exec:(script)=>runInNewContext(script,context)};
}

test('renders overview and all primary navigation pages', () => {
  const app = createApp();
  assert.match(app.element('app-main').innerHTML,/Prepare with precision/);
  for (const [route, expected] of [
    ['assessments','Assessment catalog'],['practice','Practice studio'],
    ['results','Results & analytics'],['history','Session history'],
    ['memory','Memory recall'],['control','Control tracking']
  ]) {
    app.exec("navigate('"+route+"')");
    assert.match(app.element('app-main').innerHTML,new RegExp(expected,'i'),route);
    assert.equal(app.element('breadcrumb-current').textContent,
      {assessments:'Assessments',practice:'Practice studio',results:'Results & analytics',
       history:'Session history',memory:'Memory recall',control:'Control tracking'}[route]);
  }
});

test('sample results are explicitly labeled and do not overwrite browser records', () => {
  const app = createApp([]);
  app.exec("state.demo=true; navigate('history')");
  assert.match(app.element('app-main').innerHTML,/SAMPLE ONLY/);
  assert.match(app.element('app-main').innerHTML,/Demonstration data enabled/);
  assert.deepEqual(JSON.parse(app.storage.get('aerovector.v1.history')),[]);
});

test('real local assessment history can be read without changing scoring data', () => {
  const row = {id:'local-test',module:'memory',mode:'assessment',score:91,date:'2026-10-20T10:00:00Z'};
  const app = createApp([row]);
  app.exec("navigate('history')");
  assert.match(app.element('app-main').innerHTML,/local-test/);
  assert.match(app.element('app-main').innerHTML,/91%/);
  assert.doesNotMatch(app.element('app-main').innerHTML,/SAMPLE ONLY/);
  assert.equal(JSON.parse(app.storage.get('aerovector.v1.history'))[0].score,91);
});

test('session detail views make the preview-only status explicit', () => {
  const app = createApp();
  app.exec("navigate('memory')");
  assert.match(app.element('app-main').innerHTML,/Static readings/);
  app.exec("navigate('control')");
  assert.match(app.element('app-main').innerHTML,/No timer, scoring, tracking physics/);
});

test('theme defaults to light and switches to dark without changing assessment records', () => {
  const existing = [{id:'a-1',module:'control',mode:'assessment',score:86,date:'2026-10-20T10:00:00Z'}];
  const app = createApp(existing);
  assert.equal(app.context.document.documentElement.dataset.theme, 'light');
  app.exec("setTheme('dark')");
  assert.equal(app.context.document.documentElement.dataset.theme, 'dark');
  assert.equal(app.storage.get('aerovector.v1.theme'), 'dark');
  assert.deepEqual(JSON.parse(app.storage.get('aerovector.v1.history')), existing);
  app.exec("setTheme('light')");
  assert.equal(app.storage.get('aerovector.v1.theme'), 'light');
});
test('theme accepts only light and dark; invalid input falls back to light', () => {
  const app = createApp();
  app.exec("setTheme('unknown')");
  assert.equal(app.context.document.documentElement.dataset.theme, 'light');
});
test('memory cockpit contains four required parameters and marks the display as simulated', () => {
  const app = createApp();
  app.exec("navigate('memory')");
  const html=app.element('app-main').innerHTML;
  for(const label of ['ALTITUDE','AIRSPEED','HEADING','COM 1','PFD 01 / SIMULATED','ND 02 / SIMULATED']){
    assert.ok(html.includes(label),label);
  }
  assert.match(html,/not activated in Phase 1/);
});
