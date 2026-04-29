import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('STUDENT')); // Notes are student-only

// GET /api/notes?courseId=&topicId=
router.get('/', async (req, res, next) => {
    try {
        const studentId = req.user.student?.id;
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const { courseId, topicId } = req.query;

        const notes = await prisma.studentNote.findMany({
            where: {
                studentId,
                ...(courseId && { courseId }),
                ...(topicId && { topicId }),
            },
            include: {
                course: { select: { id: true, code: true, title: true } },
                topic:  { select: { id: true, title: true } },
            },
            orderBy: { updatedAt: 'desc' },
        });

        res.json(notes);
    } catch (err) { next(err); }
});

// POST /api/notes
router.post('/', async (req, res, next) => {
    try {
        const studentId = req.user.student?.id;
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const { courseId, topicId, title, content, color } = req.body;
        if (!courseId || !title || !content)
            return res.status(400).json({ error: 'courseId, title and content are required' });

        const note = await prisma.studentNote.create({
            data: {
                studentId,
                courseId,
                topicId: topicId || null,
                title,
                content,
                color: color || '#ffffff',
            },
            include: {
                course: { select: { id: true, code: true, title: true } },
                topic:  { select: { id: true, title: true } },
            },
        });

        res.status(201).json(note);
    } catch (err) { next(err); }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res, next) => {
    try {
        const studentId = req.user.student?.id;
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const existing = await prisma.studentNote.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Note not found' });
        if (existing.studentId !== studentId) return res.status(403).json({ error: 'Access denied' });

        const { title, content, color, topicId } = req.body;

        const note = await prisma.studentNote.update({
            where: { id: req.params.id },
            data: {
                ...(title   !== undefined && { title }),
                ...(content !== undefined && { content }),
                ...(color   !== undefined && { color }),
                ...(topicId !== undefined && { topicId: topicId || null }),
            },
            include: {
                course: { select: { id: true, code: true, title: true } },
                topic:  { select: { id: true, title: true } },
            },
        });

        res.json(note);
    } catch (err) { next(err); }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const studentId = req.user.student?.id;
        if (!studentId) return res.status(403).json({ error: 'Student profile not found' });

        const existing = await prisma.studentNote.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ error: 'Note not found' });
        if (existing.studentId !== studentId) return res.status(403).json({ error: 'Access denied' });

        await prisma.studentNote.delete({ where: { id: req.params.id } });
        res.json({ message: 'Note deleted' });
    } catch (err) { next(err); }
});

export default router;
