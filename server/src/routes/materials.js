import { Router } from 'express';
import multer from 'multer';
import { join } from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ─── Multer Configuration ─────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/materials';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.originalname.split('.').pop();
        cb(null, `${file.fieldname}-${uniqueSuffix}.${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only MP4, PDF, and PPT/PPTX are allowed.'));
        }
    }
});

// ─── Routes ───────────────────────────────────────────────────

// POST /api/materials - Upload new resource
router.post('/', requireRole('ADMIN', 'INSTRUCTOR'), upload.single('file'), async (req, res, next) => {
    try {
        const { title, description, type, courseId, semesterId, topicId, isExternal, url: externalUrl } = req.body;

        if (!title || !type || !courseId || !semesterId) {
            return res.status(400).json({ error: 'Title, type, course, and semester are required.' });
        }

        const resourceData = {
            title,
            description,
            type,
            courseId,
            semesterId,
            topicId: topicId || null,
            isExternal: isExternal === 'true' || isExternal === true,
            uploadedById: req.user.id,
        };

        if (resourceData.isExternal) {
            if (!externalUrl) return res.status(400).json({ error: 'External URL is required for external resources' });
            resourceData.url = externalUrl;
        } else {
            if (!req.file) return res.status(400).json({ error: 'File is required for local resources' });
            resourceData.url = `/uploads/materials/${req.file.filename}`;
            resourceData.fileSize = req.file.size;
        }

        const resource = await prisma.resource.create({
            data: resourceData
        });

        res.status(201).json({ resource, message: 'Resource uploaded successfully' });
    } catch (err) {
        next(err);
    }
});

// GET /api/materials - List resources with filters
router.get('/', async (req, res, next) => {
    try {
        if (req.user.role === 'STUDENT') {
            const { isStudentInResourceRestrictionPeriod } = await import('../lib/examRestrictions.js');
            const studentId = req.user.student?.id;

            if (!studentId) {
                const stu = await prisma.student.findUnique({ where: { userId: req.user.id } });
                if (stu && await isStudentInResourceRestrictionPeriod(stu.id)) {
                    return res.status(403).json({ error: 'Access restricted: You are within the 5-minute pre/post window or actively taking an exam.' });
                }
            } else if (await isStudentInResourceRestrictionPeriod(studentId)) {
                return res.status(403).json({ error: 'Access restricted: You are within the 5-minute pre/post window or actively taking an exam.' });
            }
        }

        const { courseId, semesterId, type } = req.query;
        const resources = await prisma.resource.findMany({
            where: {
                ...(courseId && { courseId }),
                ...(semesterId && { semesterId }),
                ...(type && { type })
            },
            include: {
                uploadedBy: { select: { id: true, role: true, instructor: { select: { firstName: true, lastName: true } }, admin: { select: { fullName: true } } } },
                course: { select: { code: true, title: true } },
                topic: { select: { title: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ data: resources });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/materials/:id
router.delete('/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
        if (!resource) return res.status(404).json({ error: 'Resource not found' });

        // Check if user has permission (ADMIN or the uploader)
        if (req.user.role !== 'ADMIN' && resource.uploadedById !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this resource' });
        }

        // Delete local file if exists
        if (!resource.isExternal && resource.url.startsWith('/uploads/')) {
            const filePath = join(process.cwd(), resource.url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.resource.delete({ where: { id: req.params.id } });
        res.json({ message: 'Resource deleted successfully' });
    } catch (err) {
        next(err);
    }
});

export default router;
