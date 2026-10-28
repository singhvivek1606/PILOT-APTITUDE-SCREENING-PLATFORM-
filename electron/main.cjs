'use strict';
const {app,BrowserWindow,Menu}=require('electron');
const path=require('node:path');

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
    if(!target.startsWith('file://'))event.preventDefault();
  });
  window.loadFile(path.resolve(__dirname,'../index.html'));
}
app.whenReady().then(()=>{
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
