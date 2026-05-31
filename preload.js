const { contextBridge, ipcRenderer } = require('electron');

// Expose serial port API to the renderer (web app) securely
contextBridge.exposeInMainWorld('serialAPI', {
  // List available COM ports on the Windows machine
  listPorts: () => ipcRenderer.invoke('serial:list-ports'),

  // Connect to a specific port (e.g. COM3, baud rate 9600)
  connect: (path, baudRate) => ipcRenderer.invoke('serial:connect', { path, baudRate }),

  // Listen for incoming data from the analyzer machine
  onData: (callback) => ipcRenderer.on('serial:data', (_, data) => callback(data)),

  // Listen for serial port errors
  onError: (callback) => ipcRenderer.on('serial:error', (_, err) => callback(err)),

  // Remove listeners on cleanup
  removeListeners: () => {
    ipcRenderer.removeAllListeners('serial:data');
    ipcRenderer.removeAllListeners('serial:error');
  },
});
