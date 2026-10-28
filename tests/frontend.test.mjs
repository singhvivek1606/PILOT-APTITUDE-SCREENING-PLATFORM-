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
  const document = { getElementById:element, querySelectorAll(){return []}, addEventListener(){} };
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
  assert.match(app.element('app-main').innerHTML,/NOT A LIVE TEST/);
  app.exec("navigate('control')");
  assert.match(app.element('app-main').innerHTML,/No timer, scoring, tracking physics/);
});
