import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.AGENT_PORT || 9001;

// Secret token – set AGENT_SECRET in agent/.env (same as server uses)
const AGENT_SECRET = process.env.AGENT_SECRET || 'classify-agent-secret';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ─── Auth middleware ──────────────────────────────────────
app.use((req, res, next) => {
    const auth = req.headers.authorization || '';
    const token = auth.replace('Bearer ', '');
    if (token !== AGENT_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    next();
});

// ─── Server process handle ─────────────────────────────────
let serverProcess = null;

const isRunning = () => serverProcess !== null && !serverProcess.killed;

// ─── Routes ───────────────────────────────────────────────
app.get('/status', (req, res) => {
    res.json({ running: isRunning(), pid: serverProcess?.pid ?? null });
});

app.post('/start', (req, res) => {
    if (isRunning()) return res.json({ message: 'Server already running', pid: serverProcess.pid });

    const serverEntry = resolve(__dirname, '../server/src/index.js');

    serverProcess = spawn(process.execPath, [serverEntry], {
        cwd: resolve(__dirname, '../server'),
        env: { ...process.env, NODE_ENV: 'production' },
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
