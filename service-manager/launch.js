const { spawn } = require('child_process');
const path = require('path');

console.log('--- Launcher Script ---');
const electronPath = require('electron');
console.log('Electron Path from require:', electronPath);

const p = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    windowsHide: false
});

p.on('close', (code) => {
    console.log('Electron exited with code:', code);
});
