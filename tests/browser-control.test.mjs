import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {stepControlBall,computeTrackingScore} from '../assessment-core.mjs';

test('arrow keys have an obvious direction: left/up versus right/down',()=>{
 const ball={x:.28,y:-.28,vx:0,vy:0};
 const leftDown=stepControlBall(ball,{x:-1,y:1},.05,0);
 const rightUp=stepControlBall(ball,{x:1,y:-1},.05,0);
 assert.ok(leftDown.x<ball.x,'left key should move left');
 assert.ok(leftDown.y>ball.y,'down key should move down');
 assert.ok(rightUp.x>ball.x,'right key should move right');
 assert.ok(rightUp.y<ball.y,'up key should move up');
});
test('repeated key corrections move the ball toward the red center',()=>{
 let ball={x:.7,y:-.5,vx:0,vy:0};
 const before=Math.hypot(ball.x,ball.y);
 for(let frame=0;frame<30;frame++){
   ball=stepControlBall(ball,{x:-1,y:1},1/60,frame/60);
 }
 assert.ok(Math.hypot(ball.x,ball.y)<before);
 assert.ok(Number.isFinite(computeTrackingScore({elapsed:1,onTarget:.5,integral:.2}).score));
});
test('web server serves HTML and ES modules directly in a browser',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const child=spawn(process.execPath,['web-server.cjs'],{
  cwd:root,env:{...process.env,PORT:'0',AEROVECTOR_NO_OPEN:'1'},
  stdio:['ignore','pipe','pipe']
 });
 let output='';
 try {
  const url=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Browser server did not start: '+output)),8000);
    const onData=(data)=>{
      output+=String(data);
      const m=output.match(/http:\/\/127\.0\.0\.1:\d+\//);
      if(m){clearTimeout(timeout);resolve(m[0])}
    };
    child.stdout.on('data',onData);
    child.stderr.on('data',(data)=>{output+=String(data)});
    child.on('exit',code=>{clearTimeout(timeout);reject(new Error('Server exited: '+code+' '+output))});
    child.on('error',reject);
  });
  const html=await fetch(url),module=await fetch(url+'assessment-runtime.mjs'),stylesheet=await fetch(url+'assessment.css');
  assert.equal(html.status,200);
  assert.match(await html.text(),/AEROVECTOR/);
  assert.equal(module.status,200);
  assert.match(module.headers.get('content-type'),/javascript/);
  assert.match(await module.text(),/createAssessmentRuntime/);
  assert.equal(stylesheet.status,200);
  assert.match(stylesheet.headers.get('content-type'),/css/);
 }finally{child.kill()}
});
