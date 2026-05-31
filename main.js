const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND_URL = 'https://35.254.182.189';   // GCP server — change to domain when ready

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Nidan Lab',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,                  // show after ready-to-show to avoid white flash
  });

  // Load the web app from GCP
  mainWindow.loadURL(BACKEND_URL);

  // Show window once fully loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
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
