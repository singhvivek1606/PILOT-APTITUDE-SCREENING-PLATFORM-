// Electron main process for AeroVector on Windows and macOS.
// Runs the existing HTML/CSS/JS frontend locally, without a web server.
'use strict';

const path = require('node:path');
const { app, BrowserWindow, session } = require('electron');

const APP_NAME = 'AeroVector Pilot Aptitude';
app.setName(APP_NAME);

if (process.platform === 'win32') {
  app.setAppUserModelId('com.aerovector.pilotaptitude');
}

function createWindow() {
  const win = new BrowserWindow({
    title: APP_NAME,
    width: 1360,
    height: 900,
    minWidth: 880,
    minHeight: 640,
    show: false,
    backgroundColor: '#eef3f6',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'assets', process.platform === 'darwin' ? 'aerovector.png' : 'aerovector.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: true,
    },
  });

  // Keep application content inside this desktop window; no external navigation.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());

  win.once('ready-to-show', () => win.show());
  win.webContents.once('did-finish-load', () => {
    if (!win.isVisible()) win.show();
  });

  // localStorage persists inside Electron's userData profile (separate from Chrome).
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, reply) => reply(false),
  );
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(path.join(__dirname, '..', 'assets', 'aerovector.png'));
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
