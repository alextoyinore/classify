import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/timetable
router.get('/', async (req, res, next) => {
    try {
        const { departmentId, semesterId, level } = req.query;
        const where = {
            ...(departmentId && { departmentId }),
            ...(semesterId && { semesterId }),
            ...(level && { level: Number(level) }),
        };
        const timetable = await prisma.timetableEntry.findMany({
            where,
            include: {
                course: { select: { id: true, code: true, title: true } },
                instructor: { select: { id: true, firstName: true, lastName: true } },
                department: { select: { id: true, name: true } },
                semester: { select: { id: true, name: true, sessionId: true } },
            },
            orderBy: [
                { dayOfWeek: 'asc' },
                { startTime: 'asc' }
            ]
        });
        res.json({ data: timetable });
    } catch (err) { next(err); }
});

// POST /api/timetable
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { courseId, instructorId, semesterId, departmentId, dayOfWeek, startTime, endTime, location, level } = req.body;

        // Basic validation
        if (!courseId || !semesterId || !dayOfWeek || !startTime || !endTime || !level) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const entry = await prisma.timetableEntry.create({
            data: {
                courseId,
                instructorId,
                semesterId,
                departmentId,
                dayOfWeek,
                startTime,
                endTime,
                location,
                level: Number(level)
            },
            include: {
                course: true,
                instructor: true
            }
        });
        res.status(201).json(entry);
    } catch (err) { next(err); }
});

// PATCH /api/timetable/:id
router.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { courseId, instructorId, semesterId, departmentId, dayOfWeek, startTime, endTime, location, level } = req.body;

        const entry = await prisma.timetableEntry.update({
            where: { id: req.params.id },
            data: {
                ...(courseId && { courseId }),
                ...(instructorId !== undefined && { instructorId }),
                ...(semesterId && { semesterId }),
                ...(departmentId !== undefined && { departmentId }),
                ...(dayOfWeek && { dayOfWeek }),
                ...(startTime && { startTime }),
                ...(endTime && { endTime }),
                ...(location !== undefined && { location }),
                ...(level && { level: Number(level) })
            }
        });
        res.json(entry);
    } catch (err) { next(err); }
});

// DELETE /api/timetable/:id
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        await prisma.timetableEntry.delete({ where: { id: req.params.id } });
        res.json({ message: 'Timetable entry deleted' });
    } catch (err) { next(err); }
});

export default router;
