'use strict';
/** Local browser preview; only serves this repository on the loopback address. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const root=__dirname;
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon',
  '.json':'application/json; charset=utf-8'};
const port=process.env.PORT===undefined?8000:Number(process.env.PORT);
const host='127.0.0.1';
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return}
  let filename;
  try{
    const decoded=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    filename=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
  }catch{res.writeHead(400);res.end('Invalid address');return}
  if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end('Forbidden');return}
  if(['package.json','web-server.cjs','electron/main.cjs'].includes(path.relative(root,filename).replace(/\\/g,'/')) ||
     filename.includes(path.sep+'.git'+path.sep) || filename.includes(path.sep+'node_modules'+path.sep) ||
     filename.includes(path.sep+'tests'+path.sep)){
    res.writeHead(403);res.end('Forbidden');return;
  }
  const type=types[path.extname(filename).toLowerCase()];
  if(!type){res.writeHead(404);res.end('Not found');return}
  fs.stat(filename,(err,stat)=>{
    if(err||!stat.isFile()){res.writeHead(404);res.end('Not found');return}
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD'){res.end();return}
    const stream=fs.createReadStream(filename);
    stream.on('error',()=>res.destroy());
    stream.pipe(res);
  });
});
server.listen(port,host,()=>{
  const url='http://'+host+':'+server.address().port+'/';
  console.log('\nAeroVector website running at: '+url);
  console.log('Open this address in Chrome, Edge or Firefox. Press Ctrl+C to stop.\n');
  // Open the default browser on Windows; never start a desktop-only window.
  if(process.platform==='win32'&&process.env.AEROVECTOR_NO_OPEN!=='1')execFile('explorer.exe',[url],()=>{});
});
server.on('error',error=>{
  if(error.code==='EADDRINUSE')console.error('Port '+port+' is already in use. Stop the earlier server or use another PORT.');
  else console.error(error);
  process.exitCode=1;
});
