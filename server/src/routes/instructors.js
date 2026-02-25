import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN', 'INSTRUCTOR'));

// GET /api/instructors
router.get('/', async (req, res, next) => {
    try {
        const { search, department, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            ...(department && { department }),
            ...(search && {
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { staffId: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };
        const [instructors, total] = await Promise.all([
            prisma.instructor.findMany({
                where, skip, take: Number(limit),
                orderBy: { lastName: 'asc' },
                include: {
                    user: { select: { email: true, isActive: true, lastLogin: true } },
                    courseAssignments: { include: { course: { select: { id: true, code: true, title: true } } } },
                },
            }),
            prisma.instructor.count({ where }),
        ]);
        res.json({ data: instructors, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) { next(err); }
});

// GET /api/instructors/:id
router.get('/:id', async (req, res, next) => {
    try {
        const instructor = await prisma.instructor.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { email: true, isActive: true, lastLogin: true } },
                courseAssignments: { include: { course: true } },
            },
        });
        if (!instructor) return res.status(404).json({ error: 'Instructor not found' });
        res.json({ instructor });
    } catch (err) { next(err); }
});

// POST /api/instructors
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, staffId, department, faculty, phone, qualification } = req.body;
        if (!email || !firstName || !lastName || !staffId || !department)
            return res.status(400).json({ error: 'Required fields missing' });

        const hashed = await bcrypt.hash(password || staffId, 12);
        const result = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                password: hashed,
                role: 'INSTRUCTOR',
                instructor: { create: { firstName, lastName, staffId, department, faculty, phone, qualification } },
            },
            include: { instructor: true },
        });
        res.status(201).json({ instructor: result.instructor });
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Email or staff ID already exists' });
        next(err);
    }
});

// PUT /api/instructors/:id
router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { firstName, lastName, phone, department, faculty, qualification, avatarUrl, isActive } = req.body;
        const instructor = await prisma.instructor.update({
            where: { id: req.params.id },
            data: { firstName, lastName, phone, department, faculty, qualification, avatarUrl },
        });
        if (typeof isActive === 'boolean')
            await prisma.user.update({ where: { id: instructor.userId }, data: { isActive } });
        res.json({ instructor });
    } catch (err) { next(err); }
});

// DELETE /api/instructors/:id
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const inst = await prisma.instructor.findUnique({ where: { id: req.params.id } });
        if (!inst) return res.status(404).json({ error: 'Instructor not found' });
        await prisma.user.update({ where: { id: inst.userId }, data: { isActive: false } });
        res.json({ message: 'Instructor deactivated' });
    } catch (err) { next(err); }
});

// POST /api/instructors/assign — assign instructor to course
router.post('/assign', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { instructorId, courseId, isPrimary } = req.body;
        const assignment = await prisma.courseInstructor.upsert({
            where: { courseId_instructorId: { courseId, instructorId } },
            create: { courseId, instructorId, isPrimary: isPrimary ?? true },
            update: { isPrimary: isPrimary ?? true },
        });
        res.json({ assignment });
    } catch (err) { next(err); }
});

export default router;
