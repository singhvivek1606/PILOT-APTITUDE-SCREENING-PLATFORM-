
/**
 * AeroVector frontend design preview — Phase 1.
 * Presentation and navigation only. Existing assessment engine is untouched.
 * Sample results are always explicitly labeled and never saved as real attempts.
 */
const main = document.getElementById('app-main');
const modalLayer = document.getElementById('modal-layer');
const sidebar = document.getElementById('sidebar');
const shade = document.getElementById('mobile-shade');
const toastElement = document.getElementById('toast');
const PROFILE_KEY = 'aerovector.preview.candidate';
const HISTORY_KEY = 'aerovector.v1.history';
const routes = ['overview','assessments','practice','results','history','memory','control'];
const routeNames = {overview:'Overview',assessments:'Assessments',practice:'Practice studio',results:'Results & analytics',history:'Session history',memory:'Memory recall',control:'Control tracking'};
const demoRows = [
  {id:'DEMO-104',module:'memory',mode:'assessment',score:82,date:'2026-10-24T11:20:00Z',difficulty:'Medium'},
  {id:'DEMO-103',module:'control',mode:'assessment',score:76,date:'2026-10-22T09:20:00Z',difficulty:'Standard'},
  {id:'DEMO-102',module:'memory',mode:'assessment',score:72,date:'2026-10-20T09:20:00Z',difficulty:'Easy'},
  {id:'DEMO-101',module:'control',mode:'assessment',score:69,date:'2026-10-18T09:20:00Z',difficulty:'Standard'}
];
const paths = {
  layout:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  layers:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 16l4-5 3 2 6-7"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  memory:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h6M8 17h4"/>',
  control:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/><circle cx="12" cy="12" r="2"/>',
  arrow:'<path d="M4 12h16M13 5l7 7-7 7"/>',
  back:'<path d="M20 12H4M11 19l-7-7 7-7"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  bar:'<path d="M5 20V9M11 20V4M17 20v-7M23 20V9"/>',
  export:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-7 8-7s8 2 8 7"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  shield:'<path d="m12 2 8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  play:'<path d="m8 5 12 7-12 7z"/>'
};
const state = {route:'overview',demo:false,module:'memory',mode:'practice',difficulty:'easy',profile:readProfile()};
let toastTimer = null;
function safeRead(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value===null?fallback:value}catch{return fallback}}
function readProfile(){const saved=safeRead(PROFILE_KEY,null);return saved&&typeof saved.name==='string'&&saved.name.trim()?{name:saved.name.slice(0,48)}:{name:'Candidate'}}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
function icon(name){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.info)+'</svg>'}
function btn(text,cls,attrs){return '<button type="button" class="button '+(cls||'button-outline')+'" '+(attrs||'')+'>'+text+'</button>'}
function section(title,more,action){return '<div class="section-bar"><div><h2>'+title+'</h2></div>'+(action?'<button type="button" class="section-link" data-route="'+action+'">'+more+' '+icon('arrow')+'</button>':'<span class="panel-tag">'+(more||'')+'</span>')+'</div>'}
function pageHeader(kicker,title,description,action){return '<div class="page-intro"><div><span class="eyebrow">'+kicker+'</span><h1 class="page-title">'+title+'</h1><p>'+description+'</p></div>'+(action||'')+'</div>'}
function chip(text,extra){return '<span class="chip '+(extra||'')+'">'+text+'</span>'}
function formatDate(date){const d=new Date(date);return Number.isNaN(d.getTime())?'Unknown':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
function realRows(){const data=safeRead(HISTORY_KEY,[]);return Array.isArray(data)?data.filter(function(row){return row&&row.mode==='assessment'&&(row.module==='memory'||row.module==='control')&&Number.isFinite(Number(row.score))}).map(function(row,i){return {...row,id:row.id||'LOCAL-'+(i+1),score:Math.max(0,Math.min(100,Number(row.score))),date:row.date||row.completedAt||'',difficulty:row.difficulty||'—'}}):[]}
function rows(){return state.demo?demoRows:realRows()}
function latestScore(module){const arr=rows().filter(function(x){return x.module===module});return arr.length?Math.round(Number(arr[0].score))+'%':'—'}
function average(rowsToUse){return rowsToUse.length?Math.round(rowsToUse.reduce(function(a,b){return a+Number(b.score||0)},0)/rowsToUse.length):null}
function metric(label,value,note,iconName){return '<div class="metric-card"><div class="metric-label">'+icon(iconName)+' '+label+'</div><div class="metric-value">'+value+'</div><div class="metric-note">'+note+'</div></div>'}
function liveToggle(){return '<button type="button" class="button button-outline" data-action="toggle-demo">'+(state.demo?'Hide sample data':'Show sample data')+'</button>'}
function instrument(){
 let ticks='';
 for(let i=0;i<36;i++){const a=(i*10-90)*Math.PI/180,outer=171,inner=i%3===0?151:160;const x1=200+Math.cos(a)*inner,y1=200+Math.sin(a)*inner,x2=200+Math.cos(a)*outer,y2=200+Math.sin(a)*outer;ticks+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+(i%3===0?'#bbd4d8':'#6d929e')+'" stroke-width="'+(i%3===0?2:1)+'"/>'}
 return '<svg class="flight-instrument" viewBox="0 0 400 400" aria-label="Decorative heading instrument">'
 +'<circle class="instrument-ring" cx="200" cy="200" r="188"/><circle class="instrument-inner" cx="200" cy="200" r="174"/>'
 +'<circle cx="200" cy="200" r="137" fill="none" stroke="#3c5e6e" stroke-width="1"/>'
 +'<circle cx="200" cy="200" r="105" fill="#112734" stroke="#3b5f6d" stroke-width="1"/>'
 +ticks+'<text x="200" y="64" text-anchor="middle">N</text><text x="337" y="204" text-anchor="middle">E</text><text x="200" y="345" text-anchor="middle">S</text><text x="63" y="204" text-anchor="middle">W</text>'
 +'<path d="M91 200h218M200 91v218" stroke="#567884" stroke-width="1" stroke-dasharray="5 6"/>'
 +'<path d="M148 200h104M200 148v104" stroke="#8dbcbf" stroke-width="1.5"/>'
 +'<circle cx="200" cy="200" r="39" fill="none" stroke="#a9d9d2" stroke-width="2"/>'
 +'<path d="M200 162v15M200 223v15M162 200h15M223 200h15" stroke="#a9d9d2" stroke-width="3"/>'
 +'<circle cx="200" cy="200" r="6" class="instrument-highlight"/><path d="M200 38l-9 18h18z" fill="#e8bd7e"/>'
 +'<rect x="146" y="260" width="108" height="33" rx="4" fill="#0a1d29" stroke="#416271"/>'
 +'<text x="200" y="273" text-anchor="middle" font-size="9" class="instrument-darktext">HEADING</text><text x="200" y="286" text-anchor="middle" fill="#d5eeec">274°</text>'
 +'</svg>';
}
function tracker(){
 let grid='';
 for(let p=-2;p<=2;p++){const v=110+p*31;grid+='<path d="M39 '+v+'H181M'+v+' 39V181" stroke="#385665" stroke-width=".8" opacity=".58"/>'}
 return '<svg viewBox="0 0 220 220" class="tracker-visual" aria-label="Static compensatory tracking instrument preview" role="img">'
 +'<circle cx="110" cy="110" r="104" fill="#0d2230" stroke="#6d8d9a" stroke-width="1.4"/>'
 +'<circle cx="110" cy="110" r="88" fill="#132c39" stroke="#466b77"/>'
 +'<clipPath id="tracker-clip"><circle cx="110" cy="110" r="76"/></clipPath><g clip-path="url(#tracker-clip)">'+grid+'</g>'
 +'<circle cx="110" cy="110" r="57" fill="none" stroke="#446773" stroke-dasharray="3 4"/>'
 +'<circle cx="110" cy="110" r="25" fill="#183e43" stroke="#9dcfca" stroke-width="1.6"/>'
 +'<path d="M110 33v51M110 136v51M33 110h51M136 110h51" stroke="#6a929d" stroke-width="1.4"/>'
 +'<path d="M102 110h16M110 102v16" stroke="#b7e4db" stroke-width="2.6"/>'
 +'<circle cx="139" cy="85" r="8" fill="#ebc487" stroke="#f9deb1" stroke-width="1.5"/>'
 +'<circle cx="110" cy="110" r="102" fill="none" stroke="#384f5d" stroke-dasharray="2 9" stroke-width="4"/>'
 +'</svg>';
}
function memoryConsole(detail){
 const readings=[['ALTITUDE','12,500','FT'],['AIRSPEED','245','KTS'],['HEADING','274','DEG'],['COM FREQUENCY','121.50','MHz']];
 const cssClass=detail?'console-readouts':'memory-console';
 return '<div class="'+cssClass+'">'+readings.map(function(row){return '<div class="memory-readout"><label>'+row[0]+'</label><strong>'+row[1]+' <small>'+row[2]+'</small></strong></div>'}).join('')+'</div>';
}
function moduleCard(module){
 const memory=module==='memory',name=memory?'Memory recall':'Control tracking';
 return '<article class="module-card"><div class="module-upper"><div class="module-card-head"><span class="module-id">MODULE / '+(memory?'01':'02')+'</span>'+chip(memory?'COGNITIVE':'PSYCHOMOTOR')+'</div>'
 +'<h3>'+name+'</h3><p>'+(memory?'Observe flight parameters and recall key readings under controlled time pressure.':'Maintain alignment with a moving target through continuous corrective input.')+'</p></div>'
 +'<div class="module-visual"><span class="visual-caption">'+(memory?'INSTRUMENT READINGS · PREVIEW':'COMPENSATORY TRACKING · PREVIEW')+'</span>'+(memory?memoryConsole(false):tracker())+'</div>'
 +'<div class="module-footer"><span>'+(memory?'Memory · Attention · Recall':'Coordination · Stability · Focus')+'</span><button type="button" class="section-link" data-route="'+module+'">Explore module '+icon('arrow')+'</button></div></article>';
}
function activityPanel(){
 const data=rows();
 if(!data.length)return '<div class="empty-state"><div class="empty-graphic">'+icon('chart')+'</div><h3>No assessment results yet</h3><p>Completed sessions will appear here. You can view clearly labeled demonstration data to explore this layout.</p>'+liveToggle()+'</div>';
 return '<div class="panel-heading"><h3>Recent performance</h3>'+chip(state.demo?'DEMONSTRATION DATA':'BROWSER HISTORY',state.demo?'soft-amber':'')+'</div>'+chart(data)+'<p class="centered-notice">'+(state.demo?'All values shown are fictional examples, not actual scores.':'Your earlier local assessment records are shown here.')+'</p>';
}
function overview(){
 const data=rows(),avg=average(data),best=data.length?Math.max(...data.map(function(r){return Number(r.score)})):null;
 const first=state.profile.name.split(' ')[0];
 return '<div class="page-intro"><div><span class="eyebrow">ASSESSMENT CENTER / OVERVIEW</span><h1 class="page-title">Welcome to your flight deck'+(first!=='Candidate'?', '+escapeHtml(first):'')+'.</h1><p>Your personal environment for pilot aptitude preparation and performance review.</p></div><span class="panel-tag">PHASE 01 — INTERFACE PREVIEW</span></div>'
 +'<section class="hero"><div class="hero-text"><div class="hero-kicker">AVIATION APTITUDE TRAINING</div><h1>Prepare with precision.<br><span>Perform with confidence.</span></h1><p>Build familiarity with the cognitive and coordination skills assessed during pilot selection. Explore each module and understand the training environment.</p><div class="actions">'+btn('Explore assessments '+icon('arrow'),'button-primary','data-route="assessments"')+btn('Open practice studio','button-outline','data-route="practice"')+'</div></div><div class="hero-art">'+instrument()+'<span class="instrument-caption">HEADING REFERENCE / VISUAL PREVIEW</span></div></section>'
 +section('Assessment snapshot',state.demo?'DEMONSTRATION DATA':'LOCAL BROWSER DATA')
 +'<div class="quick-grid">'+metric('Completed sessions',String(data.length),state.demo?'Illustrative sessions':'Scored local attempts','check')+metric('Average score',avg===null?'—':avg+'%',avg===null?'No recorded results':'Across completed sessions','chart')+metric('Best performance',best===null?'—':best+'%',best===null?'Awaiting first result':'Highest recorded score','target')+metric('Available modules','02','Memory & Control','layers')+'</div>'
 +section('Explore assessment modules','VIEW ALL MODULES','assessments')+'<div class="modules-grid">'+moduleCard('memory')+moduleCard('control')+'</div>'
 +section('Your training workspace','NEXT STEPS')+'<div class="grid-7-5"><section class="panel">'+activityPanel()+'</section><section class="panel"><div class="panel-heading"><h3>Getting started</h3>'+chip('GUIDE')+'</div><div class="steps"><div class="step"><span class="step-index">01</span><div><strong>Explore the assessment modules</strong><p>Understand the Memory and Control assessment objectives.</p></div></div><div class="step"><span class="step-index">02</span><div><strong>Review practice instructions</strong><p>Become familiar with the interface and the expected controls.</p></div></div><div class="step"><span class="step-index">03</span><div><strong>Begin a future training session</strong><p>Functional assessment execution will be integrated after interface approval.</p></div></div></div></section></div>';
}
function assessments(){
 return pageHeader('ASSESSMENT CATALOG','Assessments','Two essential modules designed around cognitive recall and compensatory tracking.',btn('Practice studio '+icon('arrow'),'button-outline','data-route="practice"'))
 +'<div class="page-header-panel"><div><span class="eyebrow">ASSESSMENT STRUCTURE</span><h2>Train the capabilities behind the cockpit.</h2><p>Each module has its own instructions, practice mode and scored assessment workflow. The screens below are currently design previews.</p></div><span class="page-header-mark">02</span></div>'
 +'<div class="assessment-list">'+assessmentRow('memory')+assessmentRow('control')+'</div>'
 +section('Assessment environment','PHASE 01')+'<div class="grid-2"><div class="panel"><h3>Designed for clear focus</h3><p class="panel-subtitle">A distraction-free test environment with informative controls, timing indicators and legible instrument displays.</p></div><div class="panel"><h3>Practice before assessment</h3><p class="panel-subtitle">Candidates will be able to familiarize themselves with each module before completing a timed and scored session.</p></div></div>';
}
function assessmentRow(module){
 const memory=module==='memory';
 return '<article class="assessment-row"><div class="assessment-icon">'+icon(memory?'memory':'control')+'</div><div><h3>'+(memory?'Memory recall':'Control tracking')+'</h3><p>'+(memory?'Memorize flight information, then identify missing values accurately.':'Correct continuous drift and keep an indicator within a designated target.')+'</p><div class="meta-row"><span class="meta">MODULE '+(memory?'01':'02')+'</span><span class="meta">'+(memory?'5 rounds planned':'60-second test planned')+'</span><span class="meta">Practice + assessment</span></div></div>'
 +'<div class="assessment-actions">'+btn('Review module '+icon('chevron'),'button-subtle','data-route="'+module+'"')+'</div></article>';
}
function practice(){
 return pageHeader('TRAINING / PRACTICE','Practice studio','Choose a module and explore its interface before starting a future unscored training session.')
 +'<div class="page-header-panel"><div><span class="eyebrow">FAMILIARIZATION</span><h2>Build familiarity before the clock starts.</h2><p>Practice mode will offer repeatable trials, helpful feedback and no impact on recorded assessment results.</p></div><span class="page-header-mark">PR</span></div>'
 +'<div class="grid-2">'+moduleCard('memory')+moduleCard('control')+'</div>'
 +section('How practice will work','GUIDED WORKFLOW')+'<div class="grid-2"><div class="panel"><div class="steps"><div class="step"><span class="step-index">01</span><div><strong>Choose a module</strong><p>Select Memory or Control from the available assessments.</p></div></div><div class="step"><span class="step-index">02</span><div><strong>Read the instructions</strong><p>Review the task and the expected user interactions.</p></div></div></div></div><div class="panel"><div class="steps"><div class="step"><span class="step-index">03</span><div><strong>Configure practice</strong><p>Choose the appropriate difficulty or standard tracking trial.</p></div></div><div class="step"><span class="step-index">04</span><div><strong>Review immediate feedback</strong><p>Practice attempts will not count toward official local assessment records.</p></div></div></div></div></div>';
}
function detail(module){
 const memory=module==='memory',name=memory?'Memory recall':'Control tracking';
 const modes='<div class="mode-options"><button type="button" data-mode="practice" class="mode-panel '+(state.mode==='practice'?'selected':'')+'" aria-pressed="'+(state.mode==='practice')+'"><span><strong>Practice mode</strong><small>Unscored familiarization with repeatable attempts and feedback.</small></span><span class="radio-dot"></span></button><button type="button" data-mode="assessment" class="mode-panel '+(state.mode==='assessment'?'selected':'')+'" aria-pressed="'+(state.mode==='assessment')+'"><span><strong>Assessment mode</strong><small>Timed, scored session with a warm-up trial and recorded results.</small></span><span class="radio-dot"></span></button></div>';
 const rules=memory?[
  'Study altitude, airspeed, heading and radio frequency for a short period.',
  'Recall one to four missing parameters depending on difficulty.',
  'Practice time: Easy 8 seconds, Medium 6 seconds, Hard 5 seconds.',
  'The complete assessment will have five scored rounds after a warm-up.'
 ]:[
  'Keep the moving indicator as close to the center of the circular instrument as possible.',
  'Use Arrow keys or WASD for corrective control input.',
  'The full task includes simulated drift, a practice trial and a 60-second scored run.',
  'Performance will consider time on target, deviation and control smoothness.'
 ];
 let visual=memory?'<div class="detail-console"><div class="console-top"><span>FLIGHT PARAMETERS / TRAINING SAMPLE</span><span><span class="live-dot"></span> VISUAL ONLY</span></div>'+memoryConsole(true)+'<div class="console-foot"><span>INSTRUMENT DISPLAY · DEMONSTRATION</span><span>NOT A LIVE TEST</span></div></div>'
 :'<div><div class="control-display">'+tracker()+'</div><div class="control-side-reading"><div><small>TIME ON TARGET</small><strong>—</strong></div><div><small>DEVIATION</small><strong>—</strong></div><div><small>CORRECTIONS</small><strong>—</strong></div></div></div>';
 return '<button type="button" data-route="assessments" class="section-link" style="margin-bottom:17px">'+icon('back')+' Back to assessments</button>'
 +pageHeader('MODULE '+(memory?'01 / COGNITIVE':'02 / PSYCHOMOTOR'),name,memory?'Short-term recall of flight-related information under controlled time pressure.':'Compensatory tracking and corrective hand-eye coordination.')
 +'<div class="module-detail-grid"><div><div class="panel"><div class="panel-heading"><h3>Assessment interface</h3>'+chip('VISUAL PREVIEW','soft-amber')+'</div><div class="detail-display">'+visual+'</div><div class="preview-banner">'+icon('info')+'The instrument above is a static visual preview. No timer, scoring, tracking physics or memory test is running in Phase 1.</div></div>'
 +'<div class="panel" style="margin-top:18px"><div class="panel-heading"><h3>How this assessment works</h3>'+chip('INSTRUCTIONS')+'</div><ol class="rule-list">'+rules.map(function(rule,i){return '<li><span class="rule-number">'+String(i+1).padStart(2,'0')+'</span><span>'+rule+'</span></li>'}).join('')+'</ol></div></div>'
 +'<div><div class="panel"><div class="panel-heading"><h3>Configure session</h3>'+chip('PREVIEW ONLY')+'</div><label class="form-label">Session type</label>'+modes
 +(memory?'<div class="form-group"><label class="form-label" for="difficulty">Practice difficulty</label><select id="difficulty" class="field"><option value="easy" '+(state.difficulty==='easy'?'selected':'')+'>Easy — 8 seconds / 1 missing</option><option value="medium" '+(state.difficulty==='medium'?'selected':'')+'>Medium — 6 seconds / 2 missing</option><option value="hard" '+(state.difficulty==='hard'?'selected':'')+'>Hard — 5 seconds / 4 missing</option></select></div>':'<div class="form-group"><label class="form-label">Assessment duration</label><div class="info-row"><span>Standard test</span><strong>60 seconds</strong></div><div class="info-row"><span>Warm-up</span><strong>12 seconds planned</strong></div></div>')
 +'<div class="detail-cta">'+btn('View session status '+icon('arrow'),'button-primary','data-action="session-status"')+'</div><p class="centered-notice">Session execution will be connected after design approval.</p></div><div class="panel" style="margin-top:18px"><h3>Assessment principles</h3><div class="info-row"><span>Current status</span><strong>Interface design</strong></div><div class="info-row"><span>Training mode</span><strong>Unscored</strong></div><div class="info-row"><span>Official licensing</span><strong>Not applicable</strong></div><div class="info-row"><span>Candidate data</span><strong>Local browser only</strong></div></div></div></div>';
}
function chart(data){
 const points=data.slice().reverse().slice(-7);if(!points.length)return '';
 const coords=points.map(function(r,i){return [48+(i*(483/Math.max(1,points.length-1))),188-(Number(r.score)/100)*143]});
 const d=coords.map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)}).join(' ');
 const lines=[0,25,50,75,100].map(function(n){const y=188-n/100*143;return '<path class="grid-line" d="M48 '+y+'H541"/><text x="39" y="'+(y+4)+'" text-anchor="end">'+n+'</text>'}).join('');
 return '<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 575 225" role="img" aria-label="Scores across recent assessment sessions">'+lines+'<path class="plot-line" d="'+d+'"/>'+coords.map(function(p,i){return '<circle class="plot-point" cx="'+p[0]+'" cy="'+p[1]+'" r="5"/><text x="'+p[0]+'" y="211" text-anchor="middle">S'+(i+1)+'</text>'}).join('')+'</svg></div>';
}
function dataNotice(){return state.demo?'<div class="notice"><strong>Demonstration data enabled.</strong> The visible scores and records are fictional examples for exploring the design. They are not candidate results and are not saved to assessment history.</div>':'<div class="preview-banner">'+icon('info')+'This view reads existing browser assessment history, if available. New assessments are not generated by the Phase 1 frontend preview.</div>'}
function results(){
 const data=rows(),avg=average(data);
 const highest=data.length?Math.max(...data.map(function(r){return Number(r.score)})):null;
 const mem=data.filter(function(r){return r.module==='memory'}),con=data.filter(function(r){return r.module==='control'});
 return pageHeader('PERFORMANCE / ANALYTICS','Results & analytics','Review recorded local assessment outcomes, or explore the dashboard with clearly labeled demonstration data.',liveToggle())
 +dataNotice()+'<div class="quick-grid" style="margin-top:18px">'+metric('Assessment sessions',String(data.length),state.demo?'Example records':'Local completed records','check')+metric('Average score',avg===null?'—':avg+'%','Across both modules','chart')+metric('Best score',highest===null?'—':highest+'%','Peak performance','target')+metric('Modules attempted',String([mem.length>0,con.length>0].filter(Boolean).length)+' / 2','Memory and Control','layers')+'</div>'
 +section('Performance over time','MOST RECENT SESSIONS')+'<div class="grid-7-5"><div class="panel">'+(data.length?'<div class="panel-heading"><h3>Assessment score trend</h3>'+chip(state.demo?'SAMPLE':'LOCAL',state.demo?'soft-amber':'')+'</div>'+chart(data):'<div class="empty-state"><div class="empty-graphic">'+icon('chart')+'</div><h3>No recorded sessions</h3><p>Your actual assessment scores will appear here once sessions are completed.</p>'+liveToggle()+'</div>')+'</div>'
 +'<div class="panel"><div class="panel-heading"><h3>Module summary</h3>'+chip('OVERVIEW')+'</div><div class="info-row"><span>Memory sessions</span><strong>'+mem.length+'</strong></div><div class="info-row"><span>Memory average</span><strong>'+(average(mem)===null?'—':average(mem)+'%')+'</strong></div><div class="info-row"><span>Control sessions</span><strong>'+con.length+'</strong></div><div class="info-row"><span>Control average</span><strong>'+(average(con)===null?'—':average(con)+'%')+'</strong></div><div class="info-row"><span>Most recent score</span><strong>'+(data.length?Number(data[0].score)+'%':'—')+'</strong></div></div></div>'
 +section('Result management','BROWSER DATA')+'<div class="panel"><div class="panel-heading"><div><h3>Session records</h3><p class="panel-subtitle">Assessment history is stored locally in this browser.</p></div>'+btn('View history '+icon('arrow'),'button-subtle','data-route="history"')+'</div><p class="stat-placeholder">This frontend does not create new scored sessions. Existing legacy results can still be read and displayed.</p></div>';
}
function historyView(){
 const data=rows();
 return pageHeader('PERFORMANCE / HISTORY','Session history','Browse prior local attempts and distinguish actual recorded scores from preview-only demonstration records.',liveToggle())
 +dataNotice()+'<div class="panel" style="margin-top:20px"><div class="panel-heading"><h3>Assessment records</h3>'+btn('Export actual results '+icon('export'),'button-subtle','data-action="export-real"')+'</div>'
 +(data.length?'<div class="history-table-wrap"><table class="history-table"><thead><tr><th>SESSION ID</th><th>MODULE</th><th>DATE</th><th>DIFFICULTY</th><th>SCORE</th><th>STATUS</th></tr></thead><tbody>'+data.map(function(r){return '<tr><td><strong>'+escapeHtml(r.id)+'</strong></td><td>'+escapeHtml(r.module==='memory'?'Memory recall':'Control tracking')+'</td><td>'+escapeHtml(formatDate(r.date))+'</td><td>'+escapeHtml(r.difficulty)+'</td><td><strong>'+Math.round(Number(r.score))+'%</strong></td><td>'+(state.demo?'<span class="demo-pill">SAMPLE ONLY</span>':chip('RECORDED'))+'</td></tr>'}).join('')+'</tbody></table></div>'
 :'<div class="empty-state"><div class="empty-graphic">'+icon('clock')+'</div><h3>Your history is empty</h3><p>Completed assessment sessions from the existing app will appear here. Use sample data to explore the table design.</p>'+liveToggle()+'</div>')
 +'</div>';
}
function updateProfileBadge(){
 const name=state.profile.name;document.getElementById('profile-name').textContent=name;
 document.getElementById('profile-avatar').textContent=name.trim().charAt(0).toUpperCase()||'C';
}
function render(){
 main.innerHTML=({overview:overview,assessments:assessments,practice:practice,results:results,history:historyView,memory:function(){return detail('memory')},control:function(){return detail('control')}}[state.route]||overview)();
 document.getElementById('breadcrumb-current').textContent=routeNames[state.route];
 document.querySelectorAll('[data-route]').forEach(function(el){const active=el.dataset.route===state.route;el.classList.toggle('active',active&&el.classList.contains('nav-item'));if(el.classList.contains('nav-item')){if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')}});
 document.querySelectorAll('[data-icon]').forEach(function(el){el.innerHTML=icon(el.dataset.icon)});
 updateProfileBadge();
}
function closeMenu(){sidebar.classList.remove('open');shade.hidden=true;document.getElementById('menu-button').setAttribute('aria-expanded','false')}
function toggleMenu(){const visible=!sidebar.classList.contains('open');sidebar.classList.toggle('open',visible);shade.hidden=!visible;document.getElementById('menu-button').setAttribute('aria-expanded',String(visible))}
function navigate(route,replace){
 if(!routes.includes(route))route='overview';
 state.route=route;
 if(window.location.hash!=='#'+route){if(replace)history.replaceState(null,'','#'+route);else history.pushState(null,'','#'+route)}
 closeMenu();render();window.scrollTo({top:0,behavior:'auto'});
}
function closeModal(){modalLayer.hidden=true;modalLayer.innerHTML='';document.body.style.overflow=''}
function openModal(title,body,controls){
 modalLayer.innerHTML='<div class="dialog" role="dialog" aria-modal="true" aria-label="'+escapeHtml(title)+'"><div class="dialog-top"><h2>'+escapeHtml(title)+'</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">'+icon('close')+'</button></div>'+body+'<div class="dialog-actions">'+(controls||btn('Close','button-outline','data-action="close-modal"'))+'</div></div>';
 modalLayer.hidden=false;document.body.style.overflow='hidden';
 const focus=modalLayer.querySelector('input')||modalLayer.querySelector('button');if(focus)focus.focus();
}
function sessionStatus(){
 const mode=state.mode==='practice'?'practice':'scored assessment';
 openModal('Interface preview only','<p>You selected the <strong>'+escapeHtml(state.route==='memory'?'Memory':'Control')+'</strong> module in <strong>'+mode+'</strong> mode.</p><div class="notice blue">The interface and configuration controls are functional. The test engine is intentionally not connected in this design phase. Existing assessment logic remains preserved in the repository.</div>');
}
function profileDialog(){
 openModal('Candidate preferences','<p>Personalize the local dashboard display. This information stays in your browser.</p><label class="form-label" for="candidate-name">Display name</label><input class="field" id="candidate-name" maxlength="48" autocomplete="nickname" value="'+escapeHtml(state.profile.name)+'">',btn('Cancel','button-outline','data-action="close-modal"')+btn('Save preferences','button-primary','data-action="save-profile"'));
}
function toast(message){toastElement.textContent=message;toastElement.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastElement.hidden=true},3400)}
function exportReal(){
 const data=realRows();if(!data.length){toast('There are no actual local assessment records to export.');return}
 const blob=new Blob([JSON.stringify({source:'AeroVector browser history',exportedAt:new Date().toISOString(),assessments:data},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='aerovector-results.json';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
}
document.addEventListener('click',function(e){
 const routeEl=e.target.closest('[data-route]');if(routeEl){e.preventDefault();navigate(routeEl.dataset.route);return}
 const modeEl=e.target.closest('[data-mode]');if(modeEl){state.mode=modeEl.dataset.mode;render();return}
 const actionEl=e.target.closest('[data-action]');if(!actionEl)return;
 switch(actionEl.dataset.action){
 case 'toggle-demo':state.demo=!state.demo;render();break;
 case 'session-status':sessionStatus();break;
 case 'close-modal':closeModal();break;
 case 'save-profile':{
   const input=document.getElementById('candidate-name'),name=(input?input.value:'').trim().slice(0,48);
   if(!name){if(input){input.setCustomValidity('Enter a display name.');input.reportValidity()}return}
   state.profile={name};try{localStorage.setItem(PROFILE_KEY,JSON.stringify(state.profile))}catch{toast('Browser storage is unavailable; this change is temporary.')}
   closeModal();render();toast('Candidate display preferences saved.');break;
 }
 case 'export-real':exportReal();break;
 }
});
document.getElementById('profile-button').addEventListener('click',profileDialog);
document.getElementById('menu-button').addEventListener('click',toggleMenu);
shade.addEventListener('click',closeMenu);
modalLayer.addEventListener('click',function(e){if(e.target===modalLayer)closeModal()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeModal();closeMenu()}});
document.addEventListener('change',function(e){if(e.target.id==='difficulty')state.difficulty=e.target.value});
window.addEventListener('popstate',function(){const next=location.hash.slice(1);state.route=routes.includes(next)?next:'overview';render()});
window.addEventListener('hashchange',function(){const next=location.hash.slice(1);if(routes.includes(next)&&next!==state.route){state.route=next;render()}});
const initial=location.hash.slice(1);navigate(routes.includes(initial)?initial:'overview',true);
