import {
 MODULES,DEFAULT_BINDINGS,normalizeKey,validateBindings,generateMemoryRound,difficultyForRound,studySeconds,
 evaluateMemoryAnswers,summarizeMemoryRounds,generateMathQuestion,gradeMathAnswer,
 generateOrientation,generateTask,gradeTask,scoreAccuracySpeed,computeTrackingScore,computeSlalomScore,
 overallSummary,stepControlBall,clamp
} from './assessment-core.mjs';
const HISTORY_KEY='aerovector.v1.history';
const CANDIDATE_KEY='aerovector.v2.candidate';
const BINDINGS_KEY='aerovector.v2.bindings';
const escape=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const read=(key,fallback)=>{try{const data=JSON.parse(localStorage.getItem(key));return data??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const unit=(n)=>String(n).padStart(2,'0');
const title=(module)=>MODULES[module]?.name||'Assessment';
const pill=(label)=>'<span class="module-tag">'+escape(label)+'</span>';
const number=(n)=>Number(n).toLocaleString('en-US');
const btn=(label,action,extra='')=>'<button type="button" class="button button-primary" data-test-action="'+escape(action)+'" '+extra+'>'+label+'</button>';
const formatClock=(sec)=>{const total=Math.ceil(Math.max(0,sec));return unit(Math.floor(total/60))+':'+unit(total%60)};
const directions=['up','down','left','right'];
const moduleList=['memory','control','mathematics','slalom','orientation','taskmanager'];
const registrationFields=[
 ['company','Company / Institute','text',true],['firstName','First name','text',true],['lastName','Last name','text',true],
 ['address','Address','text',true],['zipcode','Zip code','text',true],['place','Place / City','text',true],
 ['country','Country','select',true],['birthdate','Date of birth','date',true],['gender','Gender','selectGender',true],
 ['telephone','Telephone','tel',true],['email','E-mail','email',true]
];

export function createAssessmentRuntime({rerender,navigate,notify,profileChanged}){
 let candidate=read(CANDIDATE_KEY,null);
 let bindings=read(BINDINGS_KEY,{...DEFAULT_BINDINGS});
 if(!validateBindings(bindings)) bindings={...DEFAULT_BINDINGS};
 let session=null,interval=null,frame=null,lastFrame=0,held=new Set(),capture=null;
 const running=()=>Boolean(session&&session.phase!=='complete');
 const saved=()=>{const rows=read(HISTORY_KEY,[]);return Array.isArray(rows)?rows:[]};
 const saveRecord=(record)=>{const rows=saved();rows.unshift(record);write(HISTORY_KEY,rows.slice(0,300))};
 const status=()=>session;
 const cancelTimers=()=>{
  if(interval!==null){clearInterval(interval);interval=null}
  if(frame!==null){cancelAnimationFrame(frame);frame=null}
  held.clear();lastFrame=0;
 };
 function confirmLeave(route){
  if(!running()||session.module===route)return true;
  const ok=window.confirm('Leave this running assessment? Unsaved session progress will be lost.');
  if(ok){cancelTimers();session=null}
  return ok;
 }
 function labelPage(name,kicker,text){
  return '<div class="page-intro"><div><span class="eyebrow">'+escape(kicker)+'</span><h1 class="page-title">'+escape(name)+'</h1><p>'+escape(text)+'</p></div></div>';
 }
 function moduleTile(module){
  const m=MODULES[module];
  return '<article class="module-feature"><div>'+pill(m.category)+'<h3>'+escape(m.name)+'</h3><p>'+moduleDescription(module)+'</p><small>'+escape(m.duration)+' · Keyboard-accessible</small></div><button type="button" class="button button-outline" data-route="'+module+'">Open module →</button></article>';
 }
 function moduleDescription(module){
  return ({
    memory:'Remember four flight readings, then enter the missing numbers.',
    control:'Keep the moving blue ball inside the red center circle.',
    mathematics:'Answer simple maths questions about speed, distance, time and fuel.',
    slalom:'Move the small aircraft left and right through each gap.',
    orientation:'Look at the flight readings and pick the matching aircraft direction.',
    taskmanager:'Copy new flight numbers and press the key when a warning appears.'
  })[module];
 }
 function moduleHome(){
  return labelPage('Choose a test','YOUR PILOT TRAINING TESTS','Choose a test. Read the instructions, then try a practice round first.')
    +'<div class="module-features">'+moduleList.map(moduleTile).join('')+'</div>';
 }
 function registration(){
  const row=(key,label,type,required)=>{
   let control;
   const value=escape(candidate?.[key]||'');
   if(type==='select')control='<select class="field" name="'+key+'" required><option value="">Select country</option>'+['India','United Kingdom','United States','Hong Kong','Australia','Canada','Other'].map(c=>'<option '+(value===c?'selected':'')+'>'+c+'</option>').join('')+'</select>';
   else if(type==='selectGender')control='<select class="field" name="'+key+'" required><option value="">Select</option>'+['Female','Male','Non-binary','Prefer not to say'].map(c=>'<option '+(value===c?'selected':'')+'>'+c+'</option>').join('')+'</select>';
   else control='<input class="field" name="'+key+'" id="candidate-'+key+'" type="'+type+'" value="'+value+'" '+(required?'required':'')+' autocomplete="off" maxlength="150">';
   return '<label class="candidate-field"><span>'+escape(label)+' '+(required?'<b aria-label="required">*</b>':'')+'</span>'+control+'</label>';
  };
  return labelPage('Candidate registration','INTRODUCTION','Complete the candidate details before beginning scored assessments. Information stays on this device.')
  +'<form id="candidate-form" class="panel candidate-form"><div class="candidate-grid">'+registrationFields.map(x=>row(...x)).join('')+'</div>'
  +'<p class="field-help">Use Enter to move to the next field. Required fields must be completed before continuing.</p>'
  +'<div class="form-actions"><button id="candidate-submit" class="button button-primary" type="submit">Save and continue →</button></div></form>';
 }
 function settingsPage(){
  return labelPage('Keyboard controls','GLOBAL SETTINGS','Choose a key for each direction and alert acknowledgment. Changes apply to Control, Slalom and Task Manager.')
    +'<section class="panel"><h3>Active bindings</h3><div class="binding-grid">'+Object.keys(DEFAULT_BINDINGS).map(k=>'<div class="binding-row"><span>'+escape(k.toUpperCase())+'</span><button type="button" class="button button-outline" data-bind-key="'+k+'">'+escape(bindings[k])+'</button></div>').join('')+'</div>'
    +'<p class="field-help" id="binding-help">'+(capture?'Press a replacement key for '+escape(capture):'Select a binding, then press a key. Duplicate assignments are rejected.')+'</p>'
    +btn('Restore defaults','reset-bindings','')+'</section>';
 }
 const instructionLines={
  memory:['Look at the four flight numbers and remember them.','After some numbers disappear, type what you remember.','The scored test has five rounds. The numbers are shown for less time as you progress.'],
  control:['The blue ball moves on its own.','Hold arrow keys or W, A, S, D to guide the ball back inside the red circle.','Stay inside the circle as long as you can. Practice is 20 seconds. The scored test is 60 seconds.'],
  mathematics:['Read each question.','Type only the number and press Enter.','Correct and quick answers get more points.'],
  slalom:['Use left and right keys to move the aircraft symbol.','Pass between the red and green markers.','Practice first, then try three timed rounds.'],
  orientation:['Look at the flight direction readings.','Press 1, 2, 3 or 4 to choose the matching aircraft.','Correct answers earn points; wrong answers do not lose points.'],
  taskmanager:['Read the new altitude, direction and speed.','Type the numbers into the boxes and press Apply.','When the alert shows up, press Space (or your chosen alert key).']
 };
 function setupPage(module){
  const m=MODULES[module];
  if(!m)return moduleHome();
  const mode=session?.module===module?session.mode:selectedMode;
  return labelPage(m.name,'ASSESSMENT / '+m.category.toUpperCase(),moduleDescription(module))
   +'<div class="assessment-layout"><section class="panel"><div class="section-bar"><h2>Choose how to start</h2>'+pill('USE YOUR KEYBOARD')+'</div>'
   +'<div class="mode-switch"><button type="button" data-test-mode="practice" class="mode-panel '+(mode==='practice'?'selected':'')+'" aria-pressed="'+(mode==='practice')+'">Practice<small>Try it first; your result is not saved.</small></button>'
   +'<button type="button" data-test-mode="assessment" class="mode-panel '+(mode==='assessment'?'selected':'')+'" aria-pressed="'+(mode==='assessment')+'">Scored test<small>Your result is saved in this browser.</small></button></div>'
   +(module==='memory'?'<label class="form-label" for="memory-difficulty">Choose a level</label><select id="memory-difficulty" class="field"><option value="easy">Easy — 8 s</option><option value="medium">Medium — 6 s</option><option value="hard">Hard — 5 s</option></select>':'')
   +'<div class="screen-actions">'+btn('Start '+(mode==='practice'?'practice':'scored test')+' →','start')+'</div><p class="field-help">Your keys: '+escape(bindings.left)+' / '+escape(bindings.right)+' / '+escape(bindings.up)+' / '+escape(bindings.down)+' · Change them in Settings.</p></section>'
   +'<section class="panel"><h3>How to play</h3>'+(module==='control'?'<div class="control-demo" aria-label="Blue ball and red circle preview"><span class="control-demo-target"><span class="control-demo-ball"></span></span></div><p class="control-demo-caption">Bring the blue ball into the red circle.</p>':'')+'<ol class="plain-steps">'+instructionLines[module].map(i=>'<li>'+escape(i)+'</li>').join('')+'</ol>'+(module==='control'?'<div class="control-key-hint"><span>← / A</span><span>↑ / W</span><span>↓ / S</span><span>→ / D</span></div>':'')+'<p class="field-help">This is training software, not an official pilot exam.</p></section></div>';
 }
 function currentQuestion(){
  if(!session)return '';
  const s=session;
  switch(s.module){
   case 'memory': return memoryView(s);
   case 'mathematics': return mathView(s);
   case 'orientation': return orientationView(s);
   case 'taskmanager': return taskView(s);
   case 'control': return controlView(s);
   case 'slalom': return slalomView(s);
  }
  return '';
 }
 function commonHead(s,detail){
  const total=s.module==='memory'?s.total:s.module==='mathematics'?s.total:s.module==='orientation'?s.total:s.module==='slalom'?(s.mode==='practice'?1:3):null;
  return '<div class="assessment-active-head"><div>'+pill(s.mode==='practice'?'PRACTICE / UNSCORED':'ASSESSMENT / SCORED')+'<h1>'+escape(title(s.module))+'</h1><p>'+escape(detail)+'</p></div>'
   +'<div class="assessment-active-meta">'+(total?'STEP '+(Math.min(s.index+1,total))+' / '+total:'')+'<span class="timer" id="assessment-clock">'+(s.remaining!==undefined?formatClock(s.remaining):'')+'</span></div></div>';
 }
 function memoryView(s){
  const details=s.round,study=s.phase==='study';
  const fields=[['altitude','Altitude','FT'],['speed','Airspeed','KTS'],['heading','Heading','°'],['radio','COM 1','MHz']];
  const cards=fields.map(([key,label,unit])=>{
    const hidden=!study&&details.targets.includes(key);
    const value=details.values[key];
    return '<div class="memory-readout"><small>'+label+'</small><strong>'+(hidden?'— — —':escape(key==='altitude'?number(value):value))+'</strong><span>'+unit+'</span></div>';
  }).join('');
  const inputs=study?'':'<form id="memory-answer" class="answer-form"><h3>Enter the missing readings</h3><div class="answer-grid">'+details.targets.map(key=>'<label>'+escape(key.toUpperCase())+'<input class="field" name="'+key+'" required inputmode="decimal" autocomplete="off" placeholder="Enter '+key+'"></label>').join('')+'</div><button class="button button-primary" type="submit">Submit answers →</button></form>';
  return commonHead(s,study?'Memorize the cockpit indications before they disappear.':'Recall the requested readings. Category suffixes are accepted.')
   +'<div class="assessment-machine"><div class="machine-top"><span>FLIGHT DATA / '+(study?'STUDY':'RECALL')+'</span><span>ROUND '+(s.index+1)+' / '+s.total+'</span></div><div class="flight-data-grid">'+cards+'</div></div>'
   +(study?'<div class="study-progress" aria-label="Study time remaining"><div id="study-fill"></div></div><p class="field-help">The study screen will automatically advance when the countdown expires.</p>':inputs);
 }
 function mathView(s){
  return commonHead(s,'Answer without units. Press Enter to submit.')
   +'<section class="panel assessment-question"><span class="eyebrow">QUESTION '+(s.index+1)+' / '+s.total+'</span>'
   +'<h2>'+escape(s.question.prompt)+'</h2><form id="math-answer" class="math-answer"><label for="math-value">Your numerical answer</label><input class="field" id="math-value" name="answer" inputmode="decimal" autocomplete="off" required autofocus>'
   +'<button class="button button-primary">Continue →</button></form></section>';
 }
 function orientationView(s){
  const q=s.question;
  const format=o=>'Heading '+unit(Math.floor(o.heading/10))+(''+(o.heading%10))+'° · Pitch '+(o.pitch>=0?'+':'')+o.pitch+'° · RBI '+o.bearing+'°';
  return commonHead(s,'Interpret the three static instrument readings and choose the matching aircraft.')
   +'<section class="panel"><span class="eyebrow">INSTRUMENT INTERPRETATION / '+(s.index+1)+' OF '+s.total+'</span>'
   +'<div class="orientation-instruments"><div><small>RELATIVE BEARING</small><strong>'+q.bearing+'°</strong></div><div><small>ARTIFICIAL HORIZON</small><strong>'+(q.pitch>=0?'+':'')+q.pitch+'°</strong></div><div><small>COMPASS</small><strong>'+q.heading+'°</strong></div></div>'
   +'<h3>Select the matching aircraft (keyboard: 1–4)</h3><div class="orientation-choices">'+q.options.map((o,i)=>'<button type="button" data-orient-choice="'+(i+1)+'"><b>'+(i+1)+'</b><svg width="39" height="39" viewBox="0 0 40 40" aria-hidden="true" style="transform:rotate('+o.heading+'deg);flex-shrink:0"><path d="M20 2L24 17 36 23 36 27 23 25 23 34 28 36 28 38 20 36 12 38 12 36 17 34 17 25 4 27 4 23 16 17Z" fill="currentColor"/></svg><span>'+format(o)+'</span></button>').join('')+'</div></section>';
 }
 function taskView(s){
  return commonHead(s,'Keep the autopilot updated while handling alerts (alert key: '+bindings.alert+').')
   +'<div class="assessment-layout"><section class="panel"><h3>NEW INFORMATION</h3><div class="task-numbers"><span>ALTITUDE <b>'+number(s.target.altitude)+' FT</b></span><span>HEADING <b>'+s.target.heading+'°</b></span><span>SPEED <b>'+s.target.speed+' KTS</b></span></div>'
   +'<form id="task-answer"><h3>AUTOPILOT SETTINGS</h3><div class="task-fields"><label>Altitude<input name="altitude" class="field" inputmode="numeric" required></label><label>Heading<input name="heading" class="field" inputmode="numeric" required></label><label>Speed<input name="speed" class="field" inputmode="numeric" required></label></div><button class="button button-primary" type="submit">Apply settings (Enter)</button></form><p class="field-help">Applied correctly: <span id="task-correct">'+s.correct+'</span> / <span id="task-submitted">'+s.submitted+'</span></p></section>'
   +'<section class="panel alert-panel"><h3>ATTENTION MONITOR</h3><p id="alert-status" class="'+(s.alertActive?'alert-danger':'alert-idle')+'">'+(s.alertActive?'● ATTENTION: ACKNOWLEDGE ALERT':'No active warning')+'</p>'
   +'<button type="button" class="button button-outline" data-test-action="ack-alert">Acknowledge ('+escape(bindings.alert)+')</button><p class="field-help">Alerts acknowledged: <span id="alerts-ok">'+s.alertsOk+'</span> / <span id="alerts-issued">'+s.alertsIssued+'</span></p></section></div>';
 }
 function controlView(s){
  return commonHead(s,'Move the BLUE BALL into the RED CIRCLE. Use arrow keys or W, A, S, D.')
   +'<div class="assessment-layout control-play-layout"><section class="panel">'
   +'<div class="control-play-heading"><h3>Keep the ball in the middle</h3><span class="control-game-status" id="control-live-status">Guide the ball to the red circle</span></div>'
   +'<canvas class="assessment-canvas easy-control-canvas" width="620" height="440" id="control-canvas" tabindex="0" aria-label="Blue moving ball and red center target. Use arrow keys or WASD to steer."></canvas>'
   +'<div class="control-instructions"><strong>How to play:</strong> The blue ball moves by itself. Hold a direction key to bring it back. Keep it in the red circle for as long as possible.</div>'
   +'<div class="control-key-hint"><span>← / A &nbsp; Left</span><span>↑ / W &nbsp; Up</span><span>↓ / S &nbsp; Down</span><span>→ / D &nbsp; Right</span></div>'
   +'<p class="field-help">Tip: Use small corrections. Release the keys when the ball reaches the center.</p></section>'
   +'<section class="panel"><h3>Your progress</h3><div class="runtime-stats">'
   +'<div>Time in the circle <strong id="live-target">0%</strong></div>'
   +'<div>Average distance from center <strong id="live-deviation">—</strong></div>'
   +'<div>Key presses <strong id="live-corrections">0</strong></div></div>'
   +'<p class="field-help">More time in the center gives you a higher score.</p>'
   +'<div class="control-legend"><span><i class="legend-blue"></i> Moving blue ball</span><span><i class="legend-red"></i> Red target</span></div>'
   +btn('Stop this round','finish')+'</section></div>';
 }
 function slalomView(s){
  return commonHead(s,'Keep the aircraft between moving colored marker pairs. Steer with '+bindings.left+' and '+bindings.right+'.')
   +'<div class="assessment-layout"><section class="panel"><h3>SLALOM TRACKING · RUN '+(s.run+1)+'</h3><canvas class="assessment-canvas" width="620" height="450" id="slalom-canvas" tabindex="0" aria-label="Slalom gate tracking display"></canvas></section>'
   +'<section class="panel"><h3>Gate telemetry</h3><div class="runtime-stats"><div>Gates passed <strong id="slalom-count">0</strong></div><div>Center accuracy <strong id="slalom-score">0%</strong></div><div>Steering <strong>'+escape(bindings.left)+' / '+escape(bindings.right)+'</strong></div></div>'+btn('End trial','finish')+'</section></div>';
 }
 function completeView(s){
  const rec=s.record;
  return labelPage('Session complete','RESULTS / '+(s.mode==='practice'?'PRACTICE':'ASSESSMENT'),s.mode==='practice'?'This trial was not saved as a scored result.':'This assessment was saved locally to this browser.')
    +'<section class="panel completed-report"><div class="result-score">'+escape(rec.score)+'/100</div><h2>'+escape(title(s.module))+'</h2><p>'+escape(rec.details||'Session finished')+'</p><div class="screen-actions">'
    +'<button class="button button-outline" type="button" data-test-action="restart">Try again</button>'
    +'<button class="button button-primary" type="button" data-route="results">View results →</button></div></section>';
 }
 function view(page){
  if(page==='registration')return registration();
  if(page==='settings')return settingsPage();
  if(page==='assessments')return moduleHome();
  if(!MODULES[page])return '';
  if(session&&session.module===page){
    return session.phase==='complete'?completeView(session):currentQuestion();
  }
  return setupPage(page);
 }

 function chooseModule(module){
  if(!MODULES[module])return;
  if(session&&session.module!==module){cancelTimers();session=null}
  navigate(module);
 }
 function begin(module,mode,startingDifficulty='easy'){
  if(mode==='assessment'&&!candidate){notify('Complete candidate registration before a scored assessment.');navigate('registration');return}
  cancelTimers();
  const base={module,mode,phase:'running',index:0,start:performance.now(),remaining:0,correct:0,submitted:0,total:0,elapsed:0,answeredTimes:[]};
  session=base;
  if(module==='memory'){
   base.total=mode==='practice'?1:5;base.rounds=[];base.difficulty=startingDifficulty;
   nextMemoryRound();
  }else if(module==='mathematics'){
   base.total=mode==='practice'?3:8;base.question=generateMathQuestion();base.questionStarted=performance.now();rerender();focusField();
  }else if(module==='orientation'){
   base.total=mode==='practice'?4:12;base.remaining=mode==='practice'?120:600;
   base.question=generateOrientation();rerender();startTimer();
  }else if(module==='taskmanager'){
   base.remaining=mode==='practice'?30:60;base.target=generateTask();
   base.alertActive=false;base.alertsOk=0;base.alertsIssued=0;base.reactionMs=0;base.alertStarted=0;
   rerender();startTimer();
  }else if(module==='control'){
   base.remaining=mode==='practice'?20:60;base.duration=base.remaining;
   base.x=.40;base.y=-.20;base.vx=0;base.vy=0;base.totalTime=0;base.hitTime=0;base.deviationArea=0;base.corrections=0;
   rerender();startAnimation();
  }else if(module==='slalom'){
   base.run=0;base.remaining=mode==='practice'?30:90;base.duration=base.remaining;base.runs=[];
   initSlalomRun(base);rerender();startAnimation();
  }
 }
 function focusField(){const input=document.querySelector('main input:not([type=hidden])');if(input)input.focus()}
 function nextMemoryRound(){
  const s=session;if(!s)return;
  const difficulty=s.mode==='assessment'?difficultyForRound(s.difficulty,s.index):s.difficulty;
  s.round=generateMemoryRound(difficulty);s.phase='study';
  s.studySeconds=studySeconds(difficulty);s.remaining=s.studySeconds;s.studyStarted=performance.now();
  rerender();
  cancelTimers();
  interval=setInterval(()=>{
   if(session!==s||s.phase!=='study')return;
   s.remaining=Math.max(0,s.studySeconds-(performance.now()-s.studyStarted)/1000);
   const clock=document.getElementById('assessment-clock');if(clock)clock.textContent=formatClock(s.remaining);
   const fill=document.getElementById('study-fill');if(fill)fill.style.width=(s.remaining/s.studySeconds*100).toFixed(1)+'%';
   if(s.remaining<=0){cancelTimers();s.phase='recall';s.recallStarted=performance.now();rerender();focusField()}
  },60);
 }
 function memorySubmit(form){
  const s=session;if(!s||s.phase!=='recall')return;
  const values=Object.fromEntries(new FormData(form));
  const grade=evaluateMemoryAnswers(s.round,values);
  const seconds=(performance.now()-s.recallStarted)/1000;
  s.rounds.push({correct:grade.correct,total:grade.total,recallSeconds:seconds});
  s.index++;
  if(s.index>=s.total){
   const sum=summarizeMemoryRounds(s.rounds);
   finish({score:sum.score,accuracy:sum.accuracy,meanSeconds:sum.avgRecallSec,details:sum.correct+' of '+sum.total+' recalled readings correct; average recall '+sum.avgRecallSec+' seconds.'});
  }else nextMemoryRound();
 }
 function mathSubmit(form){
  const s=session;if(!s)return;
  const value=new FormData(form).get('answer');
  s.submitted++;if(gradeMathAnswer(value,s.question.answer))s.correct++;
  s.answeredTimes.push((performance.now()-s.questionStarted)/1000);
  s.index++;
  if(s.index>=s.total){
   const mean=s.answeredTimes.reduce((a,b)=>a+b,0)/s.answeredTimes.length;
   finish({...scoreAccuracySpeed(s.correct,s.total,mean,25),meanSeconds:+mean.toFixed(1),details:s.correct+' of '+s.total+' questions correct. Average response '+mean.toFixed(1)+' seconds.'});
  }else{
   s.question=generateMathQuestion();s.questionStarted=performance.now();rerender();focusField();
  }
 }
 function orientationAnswer(choice){
  const s=session;if(!s||s.module!=='orientation')return;
  s.submitted++;if(Number(choice)===s.question.correct)s.correct++;
  s.index++;
  if(s.index>=s.total)orientationFinish();
  else{s.question=generateOrientation();rerender()}
 }
 function orientationFinish(){
  const s=session;if(!s)return;
  const score=Math.round(s.correct/s.total*100);
  finish({score,accuracy:score,details:s.correct+' of '+s.total+' aircraft configurations correct. Incorrect answers were not penalized.'});
 }
 function taskSubmit(form){
  const s=session;if(!s||s.module!=='taskmanager')return;
  const inputs=Object.fromEntries(new FormData(form));
  s.submitted++;if(gradeTask(s.target,inputs))s.correct++;
  s.target=generateTask();
  const fields=form.querySelectorAll('input');fields.forEach(el=>el.value='');
  const numbers=document.querySelectorAll('.task-numbers b');
  const values=[number(s.target.altitude)+' FT',s.target.heading+'°',s.target.speed+' KTS'];
  numbers.forEach((el,i)=>{el.textContent=values[i]});
  const c=document.getElementById('task-correct'),a=document.getElementById('task-submitted');
  if(c)c.textContent=s.correct;if(a)a.textContent=s.submitted;
  if(fields[0])fields[0].focus();
 }
 function acknowledgeAlert(){
  const s=session;if(!s||s.module!=='taskmanager'||!s.alertActive)return;
  s.alertActive=false;s.alertsOk++;s.reactionMs+=performance.now()-s.alertStarted;
  const el=document.getElementById('alert-status');
  if(el){el.className='alert-idle';el.textContent='Alert acknowledged'}
  const ok=document.getElementById('alerts-ok');if(ok)ok.textContent=s.alertsOk;
 }
 function startTimer(){
  const s=session;if(!s)return;
  cancelTimers();
  const start=performance.now(),duration=s.remaining;
  interval=setInterval(()=>{
   if(session!==s)return;
   s.remaining=Math.max(0,duration-(performance.now()-start)/1000);
   const clock=document.getElementById('assessment-clock');if(clock)clock.textContent=formatClock(s.remaining);
   if(s.module==='taskmanager'){
    const elapsed=duration-s.remaining;
    if(elapsed>=8*(s.alertsIssued+1) && !s.alertActive){
     s.alertActive=true;s.alertStarted=performance.now();s.alertsIssued++;
     const label=document.getElementById('alert-status');
     if(label){label.className='alert-danger';label.textContent='● ATTENTION: ACKNOWLEDGE ALERT'}
     const total=document.getElementById('alerts-issued');if(total)total.textContent=s.alertsIssued;
    }
   }
   if(s.remaining<=0){
    if(s.module==='orientation')orientationFinish();
    if(s.module==='taskmanager'){
     const accuracy=s.submitted?Math.round(s.correct/s.submitted*100):0;
     const alertPct=s.alertsIssued?Math.round(s.alertsOk/s.alertsIssued*100):100;
     const alertSpeed=s.alertsOk?clamp(1-(s.reactionMs/s.alertsOk)/5000,0,1):0;
     finish({score:Math.round(.55*accuracy+.30*alertPct+.15*(alertSpeed*100)),accuracy,details:s.correct+'/'+s.submitted+' autopilot updates correct; '+s.alertsOk+'/'+s.alertsIssued+' alerts acknowledged.'});
    }
   }
  },90);
 }
 function initSlalomRun(s){
  s.x=0;s.gates=[];s.timeToGate=0;s.hits=0;s.totalGates=0;s.proximitySum=0;s.elapsed=0;s.remaining=s.duration;
 }
 function controlStep(s,dt,t,wallDt=dt){
  const cx=(held.has('right')?1:0)-(held.has('left')?1:0);
  const cy=(held.has('down')?1:0)-(held.has('up')?1:0);
  const next=stepControlBall(s,{x:cx,y:cy},dt,t);
  Object.assign(s,next);
  const distance=Math.hypot(s.x,s.y);
  const counted=wallDt>.25?wallDt:dt;
  s.totalTime+=counted;
  s.deviationArea+=(wallDt>.25?1:Math.min(1,distance))*counted;
  if(wallDt<=.25&&distance<=.19)s.hitTime+=dt;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set('live-target',Math.round(100*s.hitTime/Math.max(.001,s.totalTime))+'%');
  set('live-deviation',(100*s.deviationArea/Math.max(.001,s.totalTime)).toFixed(1)+'%');
  set('live-corrections',s.corrections);
  const label=document.getElementById('control-live-status');
  if(label){
    const inside=distance<=.19;
    label.textContent=inside?'Great! Keep it here!':'Outside the circle — steer back';
    label.className='control-game-status '+(inside?'on-target':'off-target');
  }
 }
 function slalomStep(s,dt){
  s.timeToGate-=dt;
  if(s.timeToGate<=0){
   s.gates.push({y:-22,gap:Math.sin((s.elapsed+1.8)*.85)*.55,done:false});
   s.timeToGate+=1.7;
  }
  const vx=(held.has('right')?1:0)-(held.has('left')?1:0);
  s.x=clamp(s.x+vx*1.25*dt,-.9,.9);
  s.gates.forEach(g=>{
   g.y+=105*dt;
   if(!g.done&&g.y>=365){
    g.done=true;s.totalGates++;
    const distance=Math.abs(s.x-g.gap);
    if(distance<.22)s.hits++;
    s.proximitySum+=clamp(1-distance/.55,0,1);
   }
  });
  s.gates=s.gates.filter(g=>g.y<470);
  const passed=document.getElementById('slalom-count'),acc=document.getElementById('slalom-score');
  if(passed)passed.textContent=s.totalGates;
  if(acc)acc.textContent=computeSlalomScore({hits:s.hits,total:s.totalGates,proximitySum:s.proximitySum}).accuracy+'%';
 }
 function drawControl(s){
  const canvas=document.getElementById('control-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#102332';ctx.fillRect(0,0,w,h);
  const cx=w/2,cy=h/2,radius=Math.min(w*.35,h*.40);
  const gradient=ctx.createRadialGradient(cx,cy,8,cx,cy,radius*1.2);
  gradient.addColorStop(0,'#193b50');gradient.addColorStop(1,'#0e202c');
  ctx.beginPath();ctx.arc(cx,cy,radius*1.12,0,Math.PI*2);ctx.fillStyle=gradient;ctx.fill();
  ctx.lineWidth=1;
  for(let i=1;i<=4;i++){
    ctx.strokeStyle=i===4?'#7c9ca9':'#365466';
    ctx.beginPath();ctx.arc(cx,cy,radius*i/4,0,Math.PI*2);ctx.stroke();
  }
  ctx.strokeStyle='#54778b';ctx.beginPath();ctx.moveTo(cx-radius*1.08,cy);ctx.lineTo(cx+radius*1.08,cy);
  ctx.moveTo(cx,cy-radius*1.08);ctx.lineTo(cx,cy+radius*1.08);ctx.stroke();
  ctx.fillStyle='#ec6d6e18';ctx.strokeStyle='#f08082';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(cx,cy,radius*.19,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-9,cy);ctx.lineTo(cx+9,cy);ctx.moveTo(cx,cy-9);ctx.lineTo(cx,cy+9);ctx.stroke();
  const x=cx+s.x*radius,y=cy+s.y*radius;
  ctx.strokeStyle='#7ebbe176';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();
  ctx.shadowColor='#73bde9';ctx.shadowBlur=14;ctx.fillStyle='#69b8f0';
  ctx.beginPath();ctx.arc(x,y,11,0,2*Math.PI);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='#e3f4ff';ctx.lineWidth=2;ctx.stroke();
  ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillStyle='#b9d0db';ctx.fillText('KEEP THE BLUE BALL IN THE RED CIRCLE',18,24);
  ctx.textAlign='center';ctx.fillStyle='#92b3c1';ctx.fillText('ARROW KEYS OR W A S D',cx,h-17);
 }
 function drawSlalom(s){
  const canvas=document.getElementById('slalom-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#0b1822';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#274653';ctx.lineWidth=1;
  for(let x=70;x<w;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
  for(let y=25;y<h;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
  const cx=w/2;
  s.gates.forEach(g=>{
   const mid=cx+g.gap*220;
   ctx.fillStyle='#e17069';ctx.beginPath();ctx.arc(mid-51,g.y,9,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#8dd1a7';ctx.beginPath();ctx.arc(mid+51,g.y,9,0,Math.PI*2);ctx.fill();
  });
  const planeX=cx+s.x*220,planeY=365;
  ctx.strokeStyle='#6db5e6';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(planeX,planeY-16);ctx.lineTo(planeX-14,planeY+15);ctx.lineTo(planeX,planeY+7);ctx.lineTo(planeX+14,planeY+15);ctx.closePath();ctx.stroke();
  ctx.fillStyle='#bbd6e6';ctx.font='13px system-ui';ctx.fillText('Guide the aircraft through each gate',15,25);
 }
 function startAnimation(){
  cancelTimers();const s=session;if(!s)return;
  lastFrame=0;s.animationStarted=performance.now();
  const update=(now)=>{
   if(session!==s||s.phase!=='running')return;
   if(!lastFrame)lastFrame=now;
   const wallDt=Math.max(0,(now-lastFrame)/1000);const dt=clamp(wallDt,0,.05);lastFrame=now;
   s.elapsed=(now-s.animationStarted)/1000;s.remaining=Math.max(0,s.duration-s.elapsed);
   if(s.module==='control'){controlStep(s,dt,s.elapsed,wallDt);drawControl(s)}
   if(s.module==='slalom'){slalomStep(s,dt);drawSlalom(s)}
   const clock=document.getElementById('assessment-clock');if(clock)clock.textContent=formatClock(s.remaining);
   if(s.remaining<=0){finishMotion();return}
   frame=requestAnimationFrame(update);
  };
  frame=requestAnimationFrame(update);
 }
 function finishMotion(){
  const s=session;if(!s)return;
  if(s.module==='control'){
   const score=computeTrackingScore({elapsed:s.totalTime,onTarget:s.hitTime,integral:s.deviationArea,corrections:s.corrections});
   finish({score:score.score,onTarget:score.onTarget,meanDeviation:score.meanDeviation,details:score.onTarget+'% time on target; '+score.meanDeviation+'% normalized mean deviation; '+score.corrections+' corrections.'});
  } else if(s.module==='slalom'){
   const result=computeSlalomScore({hits:s.hits,total:s.totalGates,proximitySum:s.proximitySum});
   s.runs.push(result);
   if(s.mode==='assessment'&&s.run<2){
    cancelTimers();s.run++;s.index=s.run;initSlalomRun(s);rerender();startAnimation();
   }else{
    const score=Math.round(s.runs.reduce((sum,r)=>sum+r.score,0)/s.runs.length);
    finish({score,accuracy:Math.round(s.runs.reduce((sum,r)=>sum+r.accuracy,0)/s.runs.length),details:s.runs.length+' run(s), average gate accuracy '+Math.round(s.runs.reduce((sum,r)=>sum+r.accuracy,0)/s.runs.length)+'%.'});
   }
  }
 }
 function finish(result){
  if(!session||session.phase==='complete')return;
  const s=session;cancelTimers();
  s.phase='complete';
  s.record={
   id:'AV-'+Date.now(),module:s.module,mode:s.mode,date:new Date().toISOString(),score:Math.max(0,Math.min(100,Math.round(result.score||0))),
   accuracy:result.accuracy??result.onTarget??null,onTarget:result.onTarget??null,avgDeviation:result.meanDeviation??null,
   details:result.details||'',candidateId:candidate?.id||null,
   difficulty:s.difficulty||null
  };
  if(s.mode==='assessment')saveRecord(s.record);
  rerender();
 }
 function startFromPage(module){
  const mode=selectedMode;
  const chosenDifficulty=document.getElementById('memory-difficulty')?.value||document.getElementById('difficulty')?.value||selectedDifficulty;
  begin(module,mode,chosenDifficulty);
 }
 function handleClick(event,page){
  const target=event.target;
  const mode=target.closest('[data-test-mode]');
  if(mode){event.preventDefault();selectedMode=mode.dataset.testMode;rerender();return true}
  const orientation=target.closest('[data-orient-choice]');
  if(orientation){event.preventDefault();orientationAnswer(orientation.dataset.orientChoice);return true}
  const binding=target.closest('[data-bind-key]');
  if(binding){event.preventDefault();capture=binding.dataset.bindKey;notify('Press the new key for '+capture+'.');rerender();return true}
  const action=target.closest('[data-test-action]');
  if(!action)return false;
  event.preventDefault();
  switch(action.dataset.testAction){
   case 'start':startFromPage(page);break;
   case 'finish': if(session?.module==='control'||session?.module==='slalom'){const s=session;cancelTimers();session=null;notify(s.mode==='assessment'?'Assessment stopped. No result was recorded.':'Practice stopped.');rerender()}break;
   case 'ack-alert':acknowledgeAlert();break;
   case 'restart':{const mod=session?.module;if(mod){session=null;selectedMode='practice';rerender()};break}
   case 'reset-bindings':bindings={...DEFAULT_BINDINGS};write(BINDINGS_KEY,bindings);capture=null;rerender();break;
  }
  return true;
 }
 function handleChange(event){
  if(event.target.id==='memory-difficulty')selectedDifficulty=event.target.value;
 }
 function handleSubmit(event){
  const id=event.target.id;
  if(!['candidate-form','memory-answer','math-answer','task-answer'].includes(id))return false;
  event.preventDefault();const form=event.target;
  if(!form.reportValidity())return true;
  if(id==='candidate-form'){
   const data=Object.fromEntries(new FormData(form));
   const email=String(data.email||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){notify('Please enter a valid email address.');return true}
   candidate={...data,id:candidate?.id||'AVC-'+Date.now()};
   write(CANDIDATE_KEY,candidate);profileChanged(candidate.firstName+' '+candidate.lastName);
   notify('Candidate registration saved locally.');navigate('assessments');
  }else if(id==='memory-answer')memorySubmit(form);
  else if(id==='math-answer')mathSubmit(form);
  else if(id==='task-answer')taskSubmit(form);
  return true;
 }
 function handleKeyDown(event,page){
  if(capture){
   event.preventDefault();
   const key=normalizeKey(event.code||event.key);
   if(!/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Key[A-Z])$/.test(key)){notify('Choose a letter, arrow or Space key.');capture=null;rerender();return true}
   const next={...bindings,[capture]:key};
   if(!validateBindings(next)){notify('Key already in use. Choose a unique key.');capture=null;rerender();return true}
   bindings=next;write(BINDINGS_KEY,bindings);capture=null;rerender();notify('Keyboard binding updated.');return true;
  }
  if(page==='registration'&&event.key==='Enter'&&event.target.matches('#candidate-form input, #candidate-form select')){
   event.preventDefault();const elements=Array.from(document.querySelectorAll('#candidate-form input, #candidate-form select'));
   const next=elements[elements.indexOf(event.target)+1];if(next)next.focus();else document.getElementById('candidate-submit')?.focus();return true;
  }
  if(session?.phase==='running'&&session.module==='orientation'&&/^[1-4]$/.test(event.key)&&!event.repeat){event.preventDefault();orientationAnswer(Number(event.key));return true}
  if(session?.phase==='running'&&session.module==='taskmanager'&&normalizeKey(event.code)===bindings.alert){
   event.preventDefault();if(!event.repeat)acknowledgeAlert();return true;
  }
  if(session?.phase==='running'&&['control','slalom'].includes(session.module)){
   const tag=event.target.tagName.toLowerCase();if(['input','textarea','select'].includes(tag))return false;
   const code=normalizeKey(event.code);
   const directionsMapped=directions.filter(d=>code===bindings[d]);
   // The default layout accepts both Arrow keys and WASD without needing a settings change.
   const aliases={KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right'};
   if(aliases[code]&&Object.keys(DEFAULT_BINDINGS).every(k=>bindings[k]===DEFAULT_BINDINGS[k]))directionsMapped.push(aliases[code]);
   if(directionsMapped.length){
    event.preventDefault();
    for(const d of directionsMapped){if(!held.has(d)&&session.module==='control')session.corrections++;held.add(d)}
    return true;
   }
  }
  return false;
 }
 function handleKeyUp(event){
  const code=normalizeKey(event.code);
  for(const d of directions)if(code===bindings[d])held.delete(d);
  if(Object.keys(DEFAULT_BINDINGS).every(k=>bindings[k]===DEFAULT_BINDINGS[k])){
   const aliases={KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right'};
   if(aliases[code])held.delete(aliases[code]);
  }
 }
 function mount(page){
  if(!session||session.module!==page||session.phase==='complete')return;
  if(session.phase==='running'&&['control','slalom'].includes(session.module)&&frame===null)startAnimation();
  if(session.phase==='running'&&['orientation','taskmanager'].includes(session.module)&&interval===null)startTimer();
 }
 function dispose(){cancelTimers();session=null}
 function candidateName(){return candidate?(candidate.firstName+' '+candidate.lastName):'Candidate'}
 let selectedMode='practice',selectedDifficulty='easy';
 return {view,handleClick,handleChange,handleSubmit,handleKeyDown,handleKeyUp,mount,confirmLeave,dispose,status,
 setOptions:(mode,difficulty)=>{selectedMode=mode==='assessment'?'assessment':'practice';selectedDifficulty=difficulty||selectedDifficulty;},
  moduleHome,chooseModule,candidateName,registered:()=>Boolean(candidate),saved,overall:()=>overallSummary(saved())};
}
