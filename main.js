const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const APP_URL = 'https://lab.fenyxn.in';
const isDev = process.argv.includes('--dev');

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Fenyxn Lab Management',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Load the web app from GCP
  mainWindow.loadURL(APP_URL);

  // Open DevTools in dev mode or when page fails to load
  if (isDev) mainWindow.webContents.openDevTools();

  // Show window once fully loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  // Show error page if URL fails to load
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, url) => {
    mainWindow.webContents.loadURL(`data:text/html,
      <html><body style="font-family:sans-serif;padding:40px;background:#f8fafc">
      <h2 style="color:#ef4444">Cannot connect to server</h2>
      <p>URL: <code>${url}</code></p>
      <p>Error: ${errorDescription} (${errorCode})</p>
      <p>Please check your internet connection and try restarting the app.</p>
      <button onclick="window.location.href='${APP_URL}'"
        style="padding:10px 20px;background:#3b82f6;color:white;border:none;border-radius:6px;cursor:pointer">
        Retry
      </button>
      </body></html>`);
    mainWindow.show();
  });

  // Open external links in default browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Serial port IPC (ready for hardware integration) ─────────────────────────
// These handlers will be activated when the lab analyzer machine is connected.
// The renderer calls window.serialAPI.listPorts() etc. via preload.js.

ipcMain.handle('serial:list-ports', async () => {
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    return ports;
  } catch (err) {
    return [];
  }
});

ipcMain.handle('serial:connect', async (event, { path, baudRate }) => {
  try {
    const { SerialPort } = require('serialport');
    const port = new SerialPort({ path, baudRate: baudRate || 9600 });

    port.on('data', (data) => {
      // Forward raw data to renderer — renderer parses ASTM/HL7
      if (mainWindow) {
        mainWindow.webContents.send('serial:data', data.toString());
      }
    });

    port.on('error', (err) => {
      if (mainWindow) {
        mainWindow.webContents.send('serial:error', err.message);
      }
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
