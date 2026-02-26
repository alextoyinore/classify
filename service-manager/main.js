process.env.ELECTRON_RUN_AS_NODE = '';
const { app, BrowserWindow, ipcMain } = require('electron');

const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
const processes = {};

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 850,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        backgroundColor: '#F9FAFB',
        titleBarStyle: 'hiddenInset',
    });

    mainWindow.loadFile('index.html');
}

console.log('--- Environment Check ---');
console.log('ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);
console.log('process.versions.electron:', process.versions ? process.versions.electron : 'undefined');
console.log('typeof app:', typeof app);

if (app) {
    app.whenReady().then(createWindow);

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('before-quit', () => {
        Object.values(processes).forEach(p => {
            if (p) p.kill('SIGTERM');
        });
    });
} else {
    console.error('CRITICAL ERROR: Electron "app" object is STILL undefined!');
    process.exit(1);
}

ipcMain.on('start-service', (event, serviceName) => {
    if (processes[serviceName]) return;

    const cwd = path.join(__dirname, '..', serviceName === 'client' ? 'client' : 'server');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    const child = spawn(npmCmd, ['run', 'dev'], {
        cwd,
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    processes[serviceName] = child;

    child.stdout.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('service-log', { serviceName, data: data.toString() });
    });

    child.stderr.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('service-log', { serviceName, data: data.toString(), isError: true });
    });

    child.on('close', (code) => {
        processes[serviceName] = null;
        if (mainWindow) mainWindow.webContents.send('service-stopped', serviceName);
    });

    event.reply('service-started', serviceName);
});

ipcMain.on('stop-service', (event, serviceName) => {
    if (processes[serviceName]) {
        processes[serviceName].kill('SIGTERM');
        processes[serviceName] = null;
        event.reply('service-stopped', serviceName);
    }
});
