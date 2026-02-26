const { app, BrowserWindow } = require('electron');
console.log('App is:', typeof app);
if (app) {
    app.whenReady().then(() => {
        const win = new BrowserWindow({ width: 800, height: 600 });
        win.loadURL('data:text/html,<h1>Hello Electron</h1>');
    });
} else {
    console.error('Failed to get app from electron');
    process.exit(1);
}
