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

const fs = require('fs');

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

const PORT = 3005;

function updateEnvFiles(lanIP) {
    const clientEnvPath = path.join(__dirname, '..', 'client', '.env');
    const serverEnvPath = path.join(__dirname, '..', 'server', '.env');

    try {
        if (fs.existsSync(clientEnvPath)) {
            let content = fs.readFileSync(clientEnvPath, 'utf8');
            content = content.replace(/VITE_API_URL=.*/, `VITE_API_URL=http://${lanIP}:5000/api`);
            content = content.replace(/VITE_AGENT_URL=.*/, `VITE_AGENT_URL=http://${lanIP}:9001`);
            fs.writeFileSync(clientEnvPath, content);
            console.log(`Updated client/.env with IP: ${lanIP}`);
        }

        if (fs.existsSync(serverEnvPath)) {
            // Server might not need the LAN IP in its .env unless it's used for something specific,
            // but it's good practice to keep it consistent if needed.
            // Currently server/.env doesn't seem to have a variable that needs LAN IP.
        }
    } catch (err) {
        console.error('Failed to update .env files:', err);
    }
}

app.get('/api/config', (req, res) => {
    const currentIP = getLANIP();
    res.json({
        lanIP: currentIP,
        clientUrl: `http://${currentIP}:5173`,
        apiUrl: `http://${currentIP}:5000/api`,
        managerUrl: `http://${currentIP}:${PORT}`
    });
});

app.post('/api/start', (req, res) => {
    const { service } = req.body;
    const currentIP = getLANIP();

    if (!service || !['client', 'server', 'agent'].includes(service)) {
        return res.status(400).json({ error: 'Invalid service name' });
    }

    if (processes[service]) {
        return res.status(200).json({ message: `${service} is already running` });
    }

    // Auto-update environment variables for the current network
    updateEnvFiles(currentIP);

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
