import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

// In-memory settings (persisted to a JSON file for simplicity)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { DATA_DIR, LOGOS_DIR } from '../lib/paths.js';

const SETTINGS_FILE = join(DATA_DIR, '/settings.json');

const defaultSettings = {
    schoolName: process.env.SCHOOL_NAME || 'Institution Name',
    schoolAcronym: process.env.SCHOOL_ACRONYM || 'IN',
    schoolAddress: '',
    schoolEmail: '',
    schoolPhone: '',
    logoUrl: '',
    currentSession: process.env.CURRENT_SESSION || '2024/2025',
    currentSemester: process.env.CURRENT_SEMESTER || 'FIRST',
    attendanceWeight: 1,
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
        // const dir = join(__dirname, '/data');
        if (!existsSync(DATA_DIR)) { mkdirSync(dir, { recursive: true }); }
        writeFileSync(SETTINGS_FILE, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
    } catch (e) { console.error('Failed to write settings:', e); }
};

// Logo upload storage
const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, LOGOS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        cb(null, `logo.${ext}`);
    }
});
const uploadLogo = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/settings/logo — upload logo file
router.post('/logo', uploadLogo.single('logo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/logos/${req.file.filename}`;
    // Also persist the logo URL in settings automatically
    const current = readSettings();
    writeSettings({ ...current, logoUrl: url });
    res.json({ logoUrl: url });
});

// GET /api/settings/active-session — fetch active session + semester from DB
router.get('/active-session', async (req, res, next) => {
    try {
        const [session, semester] = await Promise.all([
            prisma.academicSession.findFirst({ where: { isCurrent: true } }),
            prisma.semester_.findFirst({ where: { isCurrent: true }, include: { session: true } }),
        ]);
        res.json({
            currentSession: session?.title || null,
            currentSemester: semester?.name || null,
            sessionId: session?.id || null,
            semesterId: semester?.id || null,
        });
    } catch (err) { next(err); }
});

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
