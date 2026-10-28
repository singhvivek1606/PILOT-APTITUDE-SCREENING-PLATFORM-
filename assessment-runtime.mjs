import {
 MODULES,DEFAULT_BINDINGS,normalizeKey,validateBindings,generateMemoryRound,difficultyForRound,studySeconds,
 evaluateMemoryAnswers,summarizeMemoryRounds,generateMathQuestion,gradeMathAnswer,
 generateOrientation,generateTask,gradeTask,scoreAccuracySpeed,computeTrackingScore,computeSlalomScore,
 overallSummary,clamp
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
    memory:'Recall altitude, airspeed, heading and radio frequency after a short study period.',
    control:'Keep the horizontal needle and vertical ball centered with directional keys.',
    mathematics:'Solve applied speed, distance, time and fuel problems accurately.',
    slalom:'Steer an aircraft marker through descending pairs of colored gates.',
    orientation:'Match instrument readings to an aircraft orientation.',
    taskmanager:'Update autopilot values while also responding to alerts.'
  })[module];
 }
 function moduleHome(){
  return labelPage('Assessment modules','COMPLETE TEST BATTERY','Select a module, read its instructions and begin a keyboard-operated session.')
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
  memory:['Remember all four flight parameters when displayed.','After the study window, enter the requested missing values.','An assessment has five rounds with progressively harder questions.'],
  control:['Use the displayed directional keys to recenter both instruments.','The circular needle responds to horizontal input; the ball responds to vertical input.','Practice is 20 seconds; scored assessment lasts 60 seconds.'],
  mathematics:['Solve eight aviation arithmetic problems.','Enter the numerical answer without units and press Enter.','Accuracy and response speed determine the score.'],
  slalom:['Use left/right keys to steer the aircraft symbol.','Pass between the paired red/green gates as they move down the screen.','Scored assessment includes three 90-second runs. Practice lasts 30 seconds.'],
  orientation:['Interpret the relative bearing indicator, artificial horizon and compass.','Choose which of four aircraft configurations matches the instruments.','The 10-minute assessment awards one point per correct answer, without penalties.'],
  taskmanager:['Copy incoming altitude, heading and speed into autopilot settings.','Press the mapped alert acknowledgment key when an alert appears.','Both tasks run simultaneously for 60 seconds.']
 };
 function setupPage(module){
  const m=MODULES[module];
  if(!m)return moduleHome();
  const mode=session?.module===module?session.mode:selectedMode;
  return labelPage(m.name,'ASSESSMENT / '+m.category.toUpperCase(),moduleDescription(module))
   +'<div class="assessment-layout"><section class="panel"><div class="section-bar"><h2>Session configuration</h2>'+pill('KEYBOARD OPERATED')+'</div>'
   +'<div class="mode-switch"><button type="button" data-test-mode="practice" class="mode-panel '+(mode==='practice'?'selected':'')+'" aria-pressed="'+(mode==='practice')+'">Practice mode<small>Unscored trial</small></button>'
   +'<button type="button" data-test-mode="assessment" class="mode-panel '+(mode==='assessment'?'selected':'')+'" aria-pressed="'+(mode==='assessment')+'">Assessment mode<small>Results saved locally</small></button></div>'
   +(module==='memory'?'<label class="form-label" for="memory-difficulty">Starting difficulty</label><select id="memory-difficulty" class="field"><option value="easy">Easy — 8 s</option><option value="medium">Medium — 6 s</option><option value="hard">Hard — 5 s</option></select>':'')
   +'<div class="screen-actions">'+btn('Begin '+(mode==='practice'?'practice':'assessment')+' →','start')+'</div><p class="field-help">Your current bindings: '+escape(bindings.left)+' / '+escape(bindings.right)+' / '+escape(bindings.up)+' / '+escape(bindings.down)+' · Configure in Settings.</p></section>'
   +'<section class="panel"><h3>Instructions</h3><ol class="plain-steps">'+instructionLines[module].map(i=>'<li>'+escape(i)+'</li>').join('')+'</ol><p class="field-help">These are training tasks, not certified airline selection tests.</p></section></div>';
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
   +'<h3>Select the matching aircraft (keyboard: 1–4)</h3><div class="orientation-choices">'+q.options.map((o,i)=>'<button type="button" data-orient-choice="'+(i+1)+'"><b>'+(i+1)+'</b><span>'+format(o)+'</span></button>').join('')+'</div></section>';
 }
 function taskView(s){
  return commonHead(s,'Keep the autopilot updated while handling alerts (alert key: '+bindings.alert+').')
   +'<div class="assessment-layout"><section class="panel"><h3>NEW INFORMATION</h3><div class="task-numbers"><span>ALTITUDE <b>'+number(s.target.altitude)+' FT</b></span><span>HEADING <b>'+s.target.heading+'°</b></span><span>SPEED <b>'+s.target.speed+' KTS</b></span></div>'
   +'<form id="task-answer"><h3>AUTOPILOT SETTINGS</h3><div class="task-fields"><label>Altitude<input name="altitude" class="field" inputmode="numeric" required></label><label>Heading<input name="heading" class="field" inputmode="numeric" required></label><label>Speed<input name="speed" class="field" inputmode="numeric" required></label></div><button class="button button-primary" type="submit">Apply settings (Enter)</button></form><p class="field-help">Applied correctly: <span id="task-correct">'+s.correct+'</span> / <span id="task-submitted">'+s.submitted+'</span></p></section>'
   +'<section class="panel alert-panel"><h3>ATTENTION MONITOR</h3><p id="alert-status" class="'+(s.alertActive?'alert-danger':'alert-idle')+'">'+(s.alertActive?'● ATTENTION: ACKNOWLEDGE ALERT':'No active warning')+'</p>'
   +'<button type="button" class="button button-outline" data-test-action="ack-alert">Acknowledge ('+escape(bindings.alert)+')</button><p class="field-help">Alerts acknowledged: <span id="alerts-ok">'+s.alertsOk+'</span> / <span id="alerts-issued">'+s.alertsIssued+'</span></p></section></div>';
 }
 function controlView(s){
  return commonHead(s,'Keep the blue needle and blue ball aligned with the red target marks. Use '+bindings.left+' / '+bindings.right+' / '+bindings.up+' / '+bindings.down+'.')
   +'<div class="assessment-layout"><section class="panel"><h3>COMPENSATORY TRACKING</h3><canvas class="assessment-canvas" width="620" height="405" id="control-canvas" tabindex="0" aria-label="Two-axis control tracking instrument"></canvas>'
   +'<p class="field-help">Hold the mapped direction keys for continuous corrections. Instrument movement uses frame-time-adjusted physics.</p></section>'
   +'<section class="panel"><h3>Live performance</h3><div class="runtime-stats"><div>Time on target <strong id="live-target">0%</strong></div><div>Mean deviation <strong id="live-deviation">—</strong></div><div>Corrections <strong id="live-corrections">0</strong></div></div>'
   +'<p class="field-help">Target: both indicators within the central tolerance. Scoring uses 70% time-on-target plus 30% proximity.</p>'+btn('End trial','finish')+'</section></div>';
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
   base.x=.37;base.y=-.28;base.vx=0;base.vy=0;base.totalTime=0;base.hitTime=0;base.deviationArea=0;base.corrections=0;
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
 function controlStep(s,dt,t){
  const left=held.has('left'),right=held.has('right'),up=held.has('up'),down=held.has('down');
  const cx=(right?1:0)-(left?1:0),cy=(down?1:0)-(up?1:0);
  const noiseX=Math.sin(t*1.2)*.18+Math.sin(t*2.9)*.11,noiseY=Math.cos(t*.92)*.14+Math.sin(t*2.2)*.12;
  s.vx=clamp((s.vx+(noiseX+cx*2.9-s.x*.22)*dt)*Math.exp(-1.7*dt),-1.3,1.3);
  s.vy=clamp((s.vy+(noiseY+cy*2.9-s.y*.22)*dt)*Math.exp(-1.7*dt),-1.3,1.3);
  s.x=clamp(s.x+s.vx*dt,-1,1);s.y=clamp(s.y+s.vy*dt,-1,1);
  const deviation=Math.sqrt((s.x*s.x+s.y*s.y)/2);
  s.totalTime+=dt;s.deviationArea+=deviation*dt;
  if(Math.abs(s.x)<.16 && Math.abs(s.y)<.16)s.hitTime+=dt;
  const pct=document.getElementById('live-target'),dev=document.getElementById('live-deviation'),cor=document.getElementById('live-corrections');
  if(pct)pct.textContent=Math.round(100*s.hitTime/s.totalTime)+'%';
  if(dev)dev.textContent=(100*s.deviationArea/s.totalTime).toFixed(1)+'%';
  if(cor)cor.textContent=s.corrections;
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
  const w=canvas.width,h=canvas.height;ctx.fillStyle='#0c1a23';ctx.fillRect(0,0,w,h);
  const centerX=220,centerY=196,radius=137;
  ctx.strokeStyle='#78919c';ctx.lineWidth=1;
  for(const r of [35,75,115,137]){ctx.beginPath();ctx.arc(centerX,centerY,r,0,Math.PI*2);ctx.stroke()}
  ctx.strokeStyle='#425c68';ctx.beginPath();ctx.moveTo(centerX-radius,centerY);ctx.lineTo(centerX+radius,centerY);ctx.moveTo(centerX,centerY-radius);ctx.lineTo(centerX,centerY+radius);ctx.stroke();
  ctx.strokeStyle='#db6860';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(centerX-15,centerY);ctx.lineTo(centerX+15,centerY);ctx.stroke();
  const angle=s.x*Math.PI*.55-Math.PI/2;
  ctx.strokeStyle='#7abbe5';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(centerX,centerY);ctx.lineTo(centerX+Math.cos(angle)*108,centerY+Math.sin(angle)*108);ctx.stroke();
  ctx.fillStyle='#74b7e0';ctx.beginPath();ctx.arc(centerX,centerY,7,0,2*Math.PI);ctx.fill();
  const barX=420,barTop=55,barBottom=337,ballY=(barTop+barBottom)/2+s.y*110;
  ctx.fillStyle='#1e303c';ctx.fillRect(barX,barTop,78,barBottom-barTop);
  ctx.strokeStyle='#6d8a98';ctx.lineWidth=2;ctx.strokeRect(barX,barTop,78,barBottom-barTop);
  ctx.strokeStyle='#d76861';ctx.beginPath();ctx.moveTo(barX-8,(barTop+barBottom)/2);ctx.lineTo(barX+86,(barTop+barBottom)/2);ctx.stroke();
  ctx.fillStyle='#71bde6';ctx.beginPath();ctx.arc(barX+39,ballY,11,0,Math.PI*2);ctx.fill();
  ctx.font='13px system-ui';ctx.fillStyle='#afc4cf';ctx.fillText('ROUND DIAL',164,370);ctx.fillText('VERTICAL AXIS',406,370);
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
  lastFrame=0;
  const update=(now)=>{
   if(session!==s||s.phase!=='running')return;
   if(!lastFrame)lastFrame=now;
   const dt=clamp((now-lastFrame)/1000,0,.05);lastFrame=now;
   s.elapsed+=dt;s.remaining=Math.max(0,s.duration-s.elapsed);
   if(s.module==='control'){controlStep(s,dt,s.elapsed);drawControl(s)}
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
  const chosenDifficulty=document.getElementById('memory-difficulty')?.value||selectedDifficulty;
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
  moduleHome,chooseModule,candidateName,registered:()=>Boolean(candidate),saved,overall:()=>overallSummary(saved())};
}
