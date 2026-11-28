// QRquick owner desktop app (Windows and Linux). A thin Electron shell around the shared web/ app: the
// same HTML, CSS and JavaScript as the website and the Android app, served from inside the application.
// Nothing here talks to the database. The page talks to Supabase exactly as the web app does, with the
// publishable key from app-web/config.js. The service-role key is never present in this app.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, net, protocol, session, shell } = require('electron');

const SCHEME = 'qrquick';
const START_URL = `${SCHEME}://app/index.html`;

// The web app is copied into app-web/ by scripts/copy-web.mjs and packed next to this file. Automated tests
// may serve another copy, but only when QRQUICK_TEST_MODE is 1; a normal launch ignores QRQUICK_WEB_DIR.
const testWebDir =
  process.env.QRQUICK_TEST_MODE === '1' && process.env.QRQUICK_WEB_DIR ? path.resolve(process.env.QRQUICK_WEB_DIR) : null;
const APP_DIR =
  testWebDir ?? (app.isPackaged ? path.join(process.resourcesPath, 'app-web') : path.join(__dirname, 'app-web'));

// Registered before the app is ready. A standard, secure scheme behaves like https for the page's scripts,
// fetch and storage, as the Android app's local origin does.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(start);
}

function start() {
  Menu.setApplicationMenu(null);

  // The app asks for no browser permission (camera, microphone, location, notifications). Refuse all of them.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

  protocol.handle(SCHEME, (request) => {
    const requested = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(APP_DIR, requested);
    if (file !== APP_DIR && !file.startsWith(APP_DIR + path.sep)) return new Response('Not found', { status: 404 });
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: 'QRquick',
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win.show());

  // Links to other websites open in the person's browser, never inside the owner app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openInBrowser(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://app/`)) {
      event.preventDefault();
      openInBrowser(url);
    }
  });

  win.loadURL(START_URL);
  return win;
}

function openInBrowser(url) {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
}

app.on('window-all-closed', () => {
  app.quit();
});
