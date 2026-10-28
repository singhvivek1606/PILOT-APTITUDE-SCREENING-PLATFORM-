import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
 MODULES,DEFAULT_BINDINGS,validateBindings,normalizeKey,randInt,scoreAccuracySpeed,
 generateMathQuestion,gradeMathAnswer,generateOrientation,generateTask,gradeTask,
 computeTrackingScore,computeSlalomScore,overallSummary
} from '../assessment-core.mjs';

test('complete module list includes all six aptitude assessment types',()=>{
 assert.deepEqual(Object.keys(MODULES),['memory','control','mathematics','slalom','orientation','taskmanager']);
});
test('control key mappings are configurable and collisions are rejected',()=>{
 assert.equal(normalizeKey('w'),'KeyW');
 assert.equal(validateBindings(DEFAULT_BINDINGS),true);
 assert.equal(validateBindings({...DEFAULT_BINDINGS,left:'KeyA',right:'KeyA'}),false);
 assert.equal(validateBindings({...DEFAULT_BINDINGS,alert:'F5'}),false);
 assert.equal(validateBindings({...DEFAULT_BINDINGS,left:'KeyA',right:'KeyD',up:'KeyW',down:'KeyS'}),true);
});
test('random number generator respects its inclusive bounds',()=>{
 assert.equal(randInt(10,15,()=>0),10);
 assert.equal(randInt(10,15,()=>.999999),15);
});
test('mathematics questions have numeric answers and validate exact numeric input',()=>{
 const q=generateMathQuestion(()=>0);
 assert.equal(q.answer,60);
 assert.equal(gradeMathAnswer('60',q.answer),true);
 assert.equal(gradeMathAnswer('60 km/h',q.answer),false);
 assert.equal(gradeMathAnswer('61',q.answer),false);
 for(const v of [.01,.21,.41,.61,.81]){
  const q=generateMathQuestion(()=>v);
  assert.ok(Number.isFinite(q.answer));
  assert.ok(q.answer>0);
 }
});
test('orientation correct option uniquely matches all three instruments',()=>{
 for(const seed of [0,.15,.36,.59,.82,.999]){
  const q=generateOrientation(()=>seed),choice=q.options[q.correct-1];
  assert.deepEqual(choice,{heading:q.heading,pitch:q.pitch,bearing:q.bearing});
  assert.equal(q.options.filter(x=>x.heading===q.heading&&x.pitch===q.pitch&&x.bearing===q.bearing).length,1);
 }
});
test('task manager copies exact numeric flight parameters',()=>{
 const task=generateTask(()=>.3);
 assert.ok(gradeTask(task,{altitude:String(task.altitude),heading:String(task.heading),speed:String(task.speed)}));
 assert.ok(!gradeTask(task,{altitude:String(task.altitude+1000),heading:task.heading,speed:task.speed}));
});
test('accuracy/speed score handles missing attempts and stays within bounds',()=>{
 assert.equal(scoreAccuracySpeed(0,0,0).score,0);
 assert.equal(scoreAccuracySpeed(10,10,0).score,100);
 assert.equal(scoreAccuracySpeed(0,10,9).score,6);
 assert.equal(scoreAccuracySpeed(99,10,-4).score,100);
});
test('control tracking uses time-on-target and normalized deviation',()=>{
 assert.deepEqual(computeTrackingScore({elapsed:0}),{score:0,onTarget:0,meanDeviation:0,corrections:0});
 const q=computeTrackingScore({elapsed:60,onTarget:48,integral:12,corrections:11});
 assert.equal(q.onTarget,80);assert.equal(q.meanDeviation,20);assert.equal(q.score,80);
 assert.ok(computeTrackingScore({elapsed:1,onTarget:10,integral:0}).score<=100);
});
test('slalom score combines gate accuracy and center precision',()=>{
 assert.equal(computeSlalomScore({}).score,0);
 assert.deepEqual(computeSlalomScore({hits:10,total:10,proximitySum:10}),{score:100,accuracy:100});
 assert.equal(computeSlalomScore({hits:0,total:10,proximitySum:0}).score,0);
});
test('overall reports only saved scored sessions and includes new modules',()=>{
 const data=[
  {module:'memory',mode:'practice',score:100},
  {module:'mathematics',mode:'assessment',score:70},
  {module:'slalom',mode:'assessment',score:90}
 ];
 const report=overallSummary(data);
 assert.equal(report.count,2);assert.equal(report.average,80);
 assert.equal(report.modules.slalom.average,90);
});
