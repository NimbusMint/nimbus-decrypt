import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { registerCryptoHandlers } from './ipc/crypto';
import { registerFileHandlers } from './ipc/fileio';

// Prevent second instances — one window only
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Disable hardware acceleration — not needed, reduces attack surface
app.disableHardwareAcceleration();

function applyContentSecurityPolicy(): void {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;

  // In dev, Vite injects an inline script for React Fast Refresh and opens an HMR
  // WebSocket. Both are blocked by the production CSP, so we loosen script-src and
  // connect-src for dev only. Production keeps the strict policy.
  const devServer = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173';
  const wsOrigin = devServer.replace(/^http/, 'ws').replace(/\/$/, '');
  const httpOrigin = devServer.replace(/\/$/, '');

  const prodDirectives = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ];

  const devDirectives = [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${httpOrigin} ${wsOrigin}`,
    "form-action 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ];

  const csp = (isDev ? devDirectives : prodDirectives).join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

function createWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: 980,
    height: 740,
    minWidth: 640,
    minHeight: 500,
    title: 'Nimbus Decrypt',
    backgroundColor: '#0f1117',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: preloadPath,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // No remote module, no node in renderer
    },
  });

  // Block all new-window / popup attempts
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Block any navigation away from the app's own origin
  win.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('file://') ||
      (process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL));
    if (!allowed) {
      event.preventDefault();
    }
  });

  // Open external links in the OS browser via setWindowOpenHandler (already set to 'deny' above)
  // shell is available for other uses if needed

  // Prevent permission escalation
  win.webContents.session.setPermissionRequestHandler((_wc, _perm, callback) => {
    callback(false);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  return win;
}

app.whenReady().then(() => {
  // Apply CSP before any window is created
  applyContentSecurityPolicy();

  registerCryptoHandlers();
  registerFileHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on('window-all-closed', () => {
  // On macOS, the convention is to keep the app running until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent certificate errors from bypassing TLS — belt-and-suspenders since
// all app content is local anyway; network requests are not expected.
app.on('certificate-error', (event, _wc, _url, _err, _cert, callback) => {
  event.preventDefault();
  callback(false);
});
