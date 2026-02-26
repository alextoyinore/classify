const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startService: (serviceName) => ipcRenderer.send('start-service', serviceName),
    stopService: (serviceName) => ipcRenderer.send('stop-service', serviceName),
    onServiceLog: (callback) => ipcRenderer.on('service-log', (_event, value) => callback(value)),
    onServiceStarted: (callback) => ipcRenderer.on('service-started', (_event, value) => callback(value)),
    onServiceStopped: (callback) => ipcRenderer.on('service-stopped', (_event, value) => callback(value)),
});
