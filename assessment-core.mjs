/* Pure assessment calculations. No DOM or network access. */
export { generateMemoryRound, difficultyForRound, studySeconds, evaluateMemoryAnswers, summarizeMemoryRounds, summarizeControl, clamp } from './core.mjs';
import { clamp } from './core.mjs';

export const MODULES = Object.freeze({
  memory:{name:'Memory recall',category:'Memory and focus',duration:'5 rounds'},
  control:{name:'Control tracking',category:'Movement and control',duration:'60 seconds'},
  mathematics:{name:'Mathematics',category:'Memory and focus',duration:'8 questions'},
  slalom:{name:'Slalom',category:'Movement and control',duration:'3 × 90 seconds'},
  orientation:{name:'Orientation',category:'Finding directions',duration:'10 minutes'},
  taskmanager:{name:'Task manager',category:'Doing two things',duration:'60 seconds'}
});
export const DEFAULT_BINDINGS=Object.freeze({
  up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight',alert:'Space'
});
export function normalizeKey(value){
  const key=String(value||'');
  if(key===' ')return 'Space';
  if(/^Key[A-Z]$/.test(key))return key;
  if(/^[a-z]$/i.test(key))return 'Key'+key.toUpperCase();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(key))return key;
  return key;
}
export function validateBindings(value){
  const selected={...DEFAULT_BINDINGS,...value};
  const names=Object.values(selected).map(normalizeKey);
  return Object.values(selected).every(v=>typeof v==='string'&&/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Key[A-Z])$/.test(normalizeKey(v)))
    &&new Set(names).size===names.length;
}
export function randInt(min,max,rng=Math.random){
  return min+Math.floor(clamp(Number(rng())||0,0,0.99999999)*(max-min+1));
}
export function scoreAccuracySpeed(correct,total,meanSeconds,parSeconds=15){
  if(!total||total<0)return {accuracy:0,speed:0,score:0};
  const accuracy=Math.round(100*clamp(correct,0,total)/total);
  const speed=Math.round(100*clamp((parSeconds-Math.max(0,meanSeconds))/parSeconds,0,1));
  return {accuracy,speed,score:Math.round(accuracy*.85+speed*.15)};
}
export function generateMathQuestion(rng=Math.random){
  const kind=randInt(0,4,rng);
  if(kind===0){
    const speed=randInt(6,24,rng)*10, hours=randInt(1,5,rng);
    return {prompt:'An aircraft flies '+(speed*hours)+' km in '+hours+' hours. What is its average speed in km/h?',answer:speed,explanation:'Speed = distance ÷ time'};
  }
  if(kind===1){
    const rate=randInt(5,18,rng)*10, hours=randInt(2,5,rng);
    return {prompt:'A flight burns '+rate+' litres of fuel per hour. How many litres are required for '+hours+' hours?',answer:rate*hours,explanation:'Fuel = hourly fuel burn × flight time'};
  }
  if(kind===2){
    const speed=randInt(8,22,rng)*10, hours=randInt(2,5,rng);
    return {prompt:'At '+speed+' km/h, how many kilometres will an aircraft cover in '+hours+' hours?',answer:speed*hours,explanation:'Distance = speed × time'};
  }
  if(kind===3){
    const speed=randInt(8,20,rng)*10,hours=randInt(1,5,rng);
    return {prompt:'How many hours are needed to fly '+(speed*hours)+' km at a constant '+speed+' km/h?',answer:hours,explanation:'Time = distance ÷ speed'};
  }
  const distance=randInt(3,18,rng)*10, minutes=30;
  return {prompt:'An aircraft travels '+distance+' km in '+minutes+' minutes. What is its average speed in km/h?',answer:distance*2,explanation:'30 minutes = 0.5 hour; speed = distance ÷ 0.5'};
}
export function gradeMathAnswer(input,expected){
  const str=String(input??'').trim();
  return /^-?\d+(?:\.\d+)?$/.test(str)&&Number(str)===Number(expected);
}
export function generateOrientation(rng=Math.random){
  const headings=[0,90,180,270],pitchOptions=[-5,0,5,10],bearingOptions=[0,90,180,270];
  const correctIndex=randInt(0,3,rng);
  const heading=headings[randInt(0,3,rng)], pitch=pitchOptions[randInt(0,3,rng)],bearing=bearingOptions[randInt(0,3,rng)];
  const answer={heading,pitch,bearing};
  const options=[0,1,2,3].map(i=>{
    if(i===correctIndex)return {...answer};
    const offset=i<correctIndex?i+1:i;
    const h=headings[(headings.indexOf(heading)+offset)%4];
    return {heading:h,pitch:pitch+(i===0?5:0),bearing:(bearing+90*(i+1))%360};
  });
  return {heading,pitch,bearing,options,correct:correctIndex+1};
}
export function generateTask(rng=Math.random){
  return {altitude:randInt(4,30,rng)*1000,heading:randInt(0,35,rng)*10,speed:randInt(14,38,rng)*10};
}
export function normalizeNumericInput(v){
  const s=String(v??'').replace(/[,\s]/g,'').trim();
  return /^\d+(?:\.\d+)?$/.test(s)?Number(s):NaN;
}
export function gradeTask(target,submitted){
  return ['altitude','heading','speed'].every(key=>normalizeNumericInput(submitted[key])===target[key]);
}
export function computeTrackingScore({elapsed=0,onTarget=0,integral=0,corrections=0}={}){
  if(elapsed<=0)return {score:0,onTarget:0,meanDeviation:0,corrections:0};
  const ratio=clamp(onTarget/elapsed,0,1),deviation=clamp(integral/elapsed,0,1.5);
  const precision=clamp(1-deviation,0,1);
  const score=Math.round(100*(.7*ratio+.3*precision));
  return {score,onTarget:Math.round(ratio*100),meanDeviation:+(deviation*100).toFixed(1),corrections};
}
export function computeSlalomScore({hits=0,total=0,proximitySum=0}={}){
  if(!total)return {score:0,accuracy:0};
  const accuracy=clamp(hits/total,0,1),center=clamp(proximitySum/total,0,1);
  return {score:Math.round(100*(.7*accuracy+.3*center)),accuracy:Math.round(accuracy*100)};
}
export function overallSummary(history=[]){
  const rows=history.filter(r=>r&&r.mode==='assessment'&&Number.isFinite(Number(r.score)));
  const modules={};
  for(const r of rows){
    if(!MODULES[r.module])continue;
    (modules[r.module]??=[]).push(Number(r.score));
  }
  return {
    count:rows.length,
    average:rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.score),0)/rows.length):null,
    modules:Object.fromEntries(Object.entries(modules).map(([k,v])=>[k,{count:v.length,average:Math.round(v.reduce((a,b)=>a+b,0)/v.length)}]))
  };
}

/**
 * Move the control ball using held direction keys.
 * x/y = -1 (left/up) to +1 (right/down).
 * The same time-adjusted calculation is used for all frame rates.
 */
export function stepControlBall(ball,input,dt,time){
  const cx=clamp(Number(input.x)||0,-1,1),cy=clamp(Number(input.y)||0,-1,1);
  const driftX=Math.sin(time*1.15+1.1)*.36+Math.sin(time*2.65)*.20;
  const driftY=Math.cos(time*1.08+.6)*.34+Math.sin(time*2.14)*.20;
  const friction=Math.exp(-2.6*dt);
  const vx=clamp(((ball.vx||0)+(driftX+cx*3.5)*dt)*friction,-1.35,1.35);
  const vy=clamp(((ball.vy||0)+(driftY+cy*3.5)*dt)*friction,-1.35,1.35);
  return {x:clamp(ball.x+vx*dt,-.92,.92),y:clamp(ball.y+vy*dt,-.92,.92),vx,vy};
}
