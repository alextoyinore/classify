import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import net from 'net';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.AGENT_PORT || 9001;

// Shared secrets with server
const JWT_SECRET = process.env.JWT_SECRET || 'classify-jwt-secret';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── Auth middleware (Verify JWT) ──────────────────────────
app.use((req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '');

    if (!token) return res.status(401).json({ error: 'Token missing' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Access denied: Admin role required' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
});

// ─── Server process handle ─────────────────────────────────
let serverProcess = null;

const checkPort = (port) => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') resolve(true);
            else resolve(false);
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port, '0.0.0.0');
    });
};

const isRunning = () => serverProcess !== null && !serverProcess.killed;

const SERVER_PORT = process.env.SERVER_PORT || 5001;

// ─── Routes ───────────────────────────────────────────────
app.get('/status', async (req, res) => {
    const agentRunning = isRunning();
    const portBusy = await checkPort(SERVER_PORT);
    res.json({
        running: agentRunning || portBusy,
        managed: agentRunning,
        port: SERVER_PORT,
        pid: serverProcess?.pid ?? null
    });
});

app.post('/start', async (req, res) => {
    if (isRunning()) return res.json({ message: 'Server already running', pid: serverProcess.pid });

    const portBusy = await checkPort(SERVER_PORT);
    if (portBusy) {
        return res.status(409).json({ error: `Port ${SERVER_PORT} is occupied by another process` });
    }

    const serverEntry = resolve(__dirname, '../server/src/index.js');

    serverProcess = spawn(process.execPath, [serverEntry], {
        cwd: resolve(__dirname, '../server'),
        env: { ...process.env, NODE_ENV: 'production', PORT: SERVER_PORT },
        stdio: 'inherit',
    });

    serverProcess.on('exit', (code) => {
        console.log(`[agent] Server exited with code ${code}`);
        serverProcess = null;
    });

    serverProcess.on('error', (err) => {
        console.error('[agent] Failed to start server:', err.message);
        serverProcess = null;
    });

    console.log(`[agent] Started server — PID ${serverProcess.pid}`);
    res.json({ message: 'Server started', pid: serverProcess.pid });
});

app.post('/stop', (req, res) => {
    if (!isRunning()) return res.json({ message: 'Server is not running' });

    serverProcess.kill('SIGTERM');
    const pid = serverProcess.pid;
    serverProcess = null;
    console.log(`[agent] Stopped server — PID ${pid}`);
    res.json({ message: 'Server stopped', pid });
});

// ─── Start agent ───────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Classify Agent running on port ${PORT}`);
});
