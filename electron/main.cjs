'use strict';
const {app,BrowserWindow,Menu,protocol,net}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');

// Secure, standard app origin: ES module imports and LocalStorage work offline.
// Do not grant Node.js APIs to the renderer.
protocol.registerSchemesAsPrivileged([{
  scheme:'aerovector',
  privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}
}]);
function createWindow(){
  const window=new BrowserWindow({
    width:1480,height:940,minWidth:960,minHeight:680,
    backgroundColor:'#cbd5d8',
    title:'AeroVector Pilot Aptitude',
    webPreferences:{
      nodeIntegration:false,contextIsolation:true,sandbox:true,
      webSecurity:true,devTools:!app.isPackaged
    }
  });
  Menu.setApplicationMenu(null);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,target)=>{
    if(!target.startsWith('aerovector://app/'))event.preventDefault();
  });
  window.loadURL('aerovector://app/index.html');
}
app.whenReady().then(()=>{
  protocol.handle('aerovector',(request)=>{
    const url=new URL(request.url);
    if(url.hostname!=='app')return new Response('Not found',{status:404});
    let rel;
    try{rel=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html'}
    catch{return new Response('Bad path',{status:400})}
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
