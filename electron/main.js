const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app, BrowserWindow, dialog } = require('electron');

// Preserve the existing desktop data directory when changing the product name.
if (app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'Aolong Finance System'));
}

let server;
let mainWindow;

const backendPort = Number(process.env.PORT || 3001);
const appRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const backendRoot = path.join(appRoot, 'backend');
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    if (fs.existsSync(windowStateFile)) {
      return JSON.parse(fs.readFileSync(windowStateFile, 'utf8'));
    }
  } catch (_) { /* 忽略损坏的状态文件 */ }
  return null;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const state = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: mainWindow.isMaximized(),
  };
  try {
    fs.writeFileSync(windowStateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (_) { /* 忽略写入失败 */ }
}

function setDefaultEnv() {
  process.env.NODE_ENV = 'production';
  process.env.MOCK_DATA_DIR = path.join(app.getPath('userData'), 'data');

  if (!process.env.JWT_SECRET) {
    const secretDir = path.join(app.getPath('userData'), 'security');
    const secretFile = path.join(secretDir, 'jwt-secret.txt');
    if (!fs.existsSync(secretDir)) {
      fs.mkdirSync(secretDir, { recursive: true });
    }
    if (!fs.existsSync(secretFile)) {
      fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), 'utf8');
    }
    process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
  }

  if (!process.env.JWT_EXPIRES_IN) {
    process.env.JWT_EXPIRES_IN = '7d';
  }
}

function startBackend() {
  return new Promise((resolve, reject) => {
    try {
      const backendApp = require(path.join(backendRoot, 'src', 'server'));
      server = backendApp.listen(backendPort, '127.0.0.1', () => resolve());
      server.on('error', (error) => {
        if (error && error.code === 'EADDRINUSE') {
          resolve();
          return;
        }
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function createMainWindow() {
  const allowedOrigin = `http://127.0.0.1:${backendPort}`;
  const savedState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: savedState?.width || 1500,
    height: savedState?.height || 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  if (savedState?.x !== undefined && savedState?.y !== undefined) {
    mainWindow.setPosition(savedState.x, savedState.y);
  }

  if (savedState?.isMaximized !== false) {
    mainWindow.maximize();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', () => {
    saveWindowState();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(allowedOrigin)) {
      event.preventDefault();
    }
  });

  mainWindow.loadURL(allowedOrigin);
}

async function boot() {
  setDefaultEnv();
  await startBackend();
  createMainWindow();
}

app.whenReady().then(boot).catch((error) => {
  dialog.showErrorBox('启动失败', `桌面端启动失败：${error.message}`);
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (server) {
    server.close();
    server = null;
  }
});
