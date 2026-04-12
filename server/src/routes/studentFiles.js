import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { UPLOADS_DIR } from '../lib/paths.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('STUDENT'));

// ─── Multer Configuration ─────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const student = req.user.student;
        if (!student || !student.matricNumber) {
            return cb(new Error('Student profile not found'));
        }
        const dir = path.join(UPLOADS_DIR, 'students', student.matricNumber);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// ─── Routes ───────────────────────────────────────────────────

// GET /api/student-files - List all files for the student
router.get('/', async (req, res, next) => {
    try {
        const files = await prisma.studentFile.findMany({
            where: { studentId: req.user.student.id },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ data: files });
    } catch (err) { next(err); }
});

// POST /api/student-files - Upload a new file
router.post('/', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const newFile = await prisma.studentFile.create({
            data: {
                studentId: req.user.student.id,
                filename: req.file.originalname,
                url: `/uploads/students/${req.user.student.matricNumber}/${req.file.filename}`,
                fileSize: req.file.size,
                mimeType: req.file.mimetype
            }
        });

        res.status(201).json({ data: newFile, message: 'File uploaded successfully' });
    } catch (err) { next(err); }
});

// DELETE /api/student-files/:id - Delete a file
router.delete('/:id', async (req, res, next) => {
    try {
        const file = await prisma.studentFile.findUnique({
            where: { id: req.params.id }
        });

        if (!file) return res.status(404).json({ error: 'File not found' });
        if (file.studentId !== req.user.student.id) return res.status(403).json({ error: 'Unauthorized' });

        // Delete from disk
        // We need to resolve the path correctly. file.url is /uploads/students/...
        // UPLOADS_DIR is project_root/uploads
        // So we need to strip '/uploads/' from the beginning of file.url
        const relativePath = file.url.replace(/^\/uploads\//, '');
        const filePath = path.join(UPLOADS_DIR, relativePath);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from DB
        await prisma.studentFile.delete({ where: { id: req.params.id } });

        res.json({ message: 'File deleted successfully' });
    } catch (err) { next(err); }
});

export default router;
