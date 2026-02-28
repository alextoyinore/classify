import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

// In-memory settings (persisted to a JSON file for simplicity)
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dirname, '../../data/settings.json');

const defaultSettings = {
    schoolName: process.env.SCHOOL_NAME || 'Institution Name',
    schoolAcronym: process.env.SCHOOL_ACRONYM || 'IN',
    schoolAddress: '',
    schoolEmail: '',
    schoolPhone: '',
    logoUrl: '',
    currentSession: process.env.CURRENT_SESSION || '2024/2025',
    currentSemester: process.env.CURRENT_SEMESTER || 'FIRST',
    attendanceWeight: 10,
    examDeletionGraceDays: 3,
    updatedAt: new Date().toISOString(),
};

export const readSettings = () => {
    try {
        if (existsSync(SETTINGS_FILE)) return JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
    } catch { }
    return defaultSettings;
};

export const writeSettings = (data) => {
    try {
        const dir = join(__dirname, '../../data');
        if (!existsSync(dir)) { import('fs').then(fs => fs.mkdirSync(dir, { recursive: true })); }
        writeFileSync(SETTINGS_FILE, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
    } catch (e) { console.error('Failed to write settings:', e); }
};

// GET /api/settings
router.get('/', (req, res) => {
    res.json({ settings: readSettings() });
});

// PUT /api/settings
router.put('/', (req, res) => {
    const current = readSettings();
    const updated = { ...current, ...req.body };
    writeSettings(updated);
    res.json({ settings: updated, message: 'Settings saved' });
});

export default router;
