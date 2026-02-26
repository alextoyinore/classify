const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');
const cors = require('cors');
const os = require('os');

// Try to dynamically require 'open' as it is ESM in newer versions.
let openLib;
(async () => {
    openLib = (await import('open')).default;
})();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const processes = {};

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function getLANIP() {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const LAN_IP = getLANIP();
const PORT = 3005;

app.get('/api/config', (req, res) => {
    res.json({
        lanIP: LAN_IP,
        clientUrl: `http://${LAN_IP}:5173`,
        apiUrl: `http://${LAN_IP}:5000/api`,
        managerUrl: `http://${LAN_IP}:${PORT}`
    });
});

app.post('/api/start', (req, res) => {
    const { service } = req.body;

    if (!service || !['client', 'server', 'agent'].includes(service)) {
        return res.status(400).json({ error: 'Invalid service name' });
    }

    if (processes[service]) {
        return res.status(200).json({ message: `${service} is already running` });
    }

    const cwd = path.join(__dirname, '..', service);
    const cmdArgs = service === 'agent' ? ['index.js'] : ['run', 'dev'];
    const cmd = service === 'agent' ? 'node' : npmCmd;

    let child;
    try {
        child = spawn(cmd, cmdArgs, {
            cwd,
            env: { ...process.env, FORCE_COLOR: '1' },
            shell: true
        });
    } catch (err) {
        console.error('Failed to spawn:', err);
        return res.status(500).json({ error: 'Failed to start service' });
    }

    processes[service] = child;

    child.stdout.on('data', (data) => {
        io.emit('service-log', { serviceName: service, data: data.toString() });
    });

    child.stderr.on('data', (data) => {
        io.emit('service-log', { serviceName: service, data: data.toString(), isError: true });
    });

    child.on('close', (code) => {
        processes[service] = null;
        io.emit('service-stopped', service);
    });

    res.status(200).json({ message: `${service} started successfully` });
    io.emit('service-started', service);
});

app.post('/api/stop', (req, res) => {
    const { service } = req.body;

    if (!service || !['client', 'server', 'agent'].includes(service)) {
        return res.status(400).json({ error: 'Invalid service name' });
    }

    if (processes[service]) {
        // Use taskkill on Windows to ensure child processes (like Vite/Nodemon) are killed
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', processes[service].pid, '/f', '/t']);
        } else {
            processes[service].kill('SIGTERM');
        }
        processes[service] = null;
        io.emit('service-stopped', service);
        res.status(200).json({ message: `${service} stopped successfully` });
    } else {
        res.status(200).json({ message: `${service} is not running` });
    }
});

app.get('/api/status', (req, res) => {
    res.json({
        client: !!processes.client,
        server: !!processes.server,
        agent: !!processes.agent
    });
});

// const PORT = 3005;
server.listen(PORT, async () => {
    console.log(`Service Manager is running at http://localhost:${PORT}`);

    // Attempt to open the browser automatically
    try {
        if (openLib) {
            await openLib(`http://localhost:${PORT}`);
        } else {
            // Fallback if import didn't finish
            import('open').then((pkg) => pkg.default(`http://localhost:${PORT}`));
        }
    } catch (e) {
        console.error('Failed to open browser automatically:', e.message);
    }
});
