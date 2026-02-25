import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/courses
router.get('/', async (req, res, next) => {
    try {
        const { search, department, level, page = 1, limit = 100 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            isActive: true,
            ...(department && { department }),
            ...(level && { level: Number(level) }),
            ...(search && {
                OR: [
                    { code: { contains: search, mode: 'insensitive' } },
                    { title: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };
        const [courses, total] = await Promise.all([
            prisma.course.findMany({
                where, skip, take: Number(limit), orderBy: { code: 'asc' },
                include: {
                    instructors: { include: { instructor: { select: { id: true, firstName: true, lastName: true } } } },
                    _count: { select: { enrollments: true } },
                },
            }),
            prisma.course.count({ where }),
        ]);
        res.json({ data: courses, total });
    } catch (err) { next(err); }
});

// GET /api/courses/:id
router.get('/:id', async (req, res, next) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: {
                instructors: { include: { instructor: true } },
                exams: { orderBy: { createdAt: 'desc' } },
                cbtExams: { orderBy: { createdAt: 'desc' } },
            },
        });
        if (!course) return res.status(404).json({ error: 'Course not found' });
        res.json(course);
    } catch (err) { next(err); }
});

// GET /api/courses/:id/students — enrolled students
router.get('/:id/students', async (req, res, next) => {
    try {
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: req.params.id },
            include: { student: { include: { user: { select: { email: true } } } } },
            orderBy: { student: { lastName: 'asc' } },
        });
        res.json(enrollments);
    } catch (err) { next(err); }
});

// POST /api/courses
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { code, title, description, creditUnits, level, department } = req.body;
        if (!code || !title || !department)
            return res.status(400).json({ error: 'Code, title, and department are required' });
        const course = await prisma.course.create({
            data: { code: code.toUpperCase(), title, description, creditUnits: Number(creditUnits) || 3, level: Number(level) || 100, department },
        });
        res.status(201).json({ course });
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Course code already exists' });
        next(err);
    }
});

// PUT /api/courses/:id
router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { title, description, creditUnits, level, department, isActive } = req.body;
        const course = await prisma.course.update({
            where: { id: req.params.id },
            data: { title, description, creditUnits: creditUnits ? Number(creditUnits) : undefined, level: level ? Number(level) : undefined, department, isActive },
        });
        res.json({ course });
    } catch (err) { next(err); }
});

// DELETE /api/courses/:id
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        await prisma.course.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ message: 'Course deactivated' });
    } catch (err) { next(err); }
});

// POST /api/courses/:id/enroll — bulk enroll students by matricNumber or studentId
router.post('/:id/enroll', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { studentIds, matricNumbers, session, semester } = req.body;
        if ((!studentIds?.length && !matricNumbers?.length) || !session || !semester)
            return res.status(400).json({ error: 'studentIds or matricNumbers, session, and semester are required' });

        let resolvedIds = studentIds || [];
        if (matricNumbers?.length) {
            const found = await prisma.student.findMany({
                where: { matricNumber: { in: matricNumbers } },
                select: { id: true },
            });
            resolvedIds = [...resolvedIds, ...found.map(s => s.id)];
        }

        const data = resolvedIds.map(studentId => ({
            studentId, courseId: req.params.id, session, semester,
        }));
        const result = await prisma.enrollment.createMany({ data, skipDuplicates: true });
        res.json({ enrolled: result.count });
    } catch (err) { next(err); }
});

// DELETE /api/courses/:id/enroll/:studentId
router.delete('/:id/enroll/:studentId', requireRole('ADMIN'), async (req, res, next) => {
    try {
        await prisma.enrollment.deleteMany({
            where: { courseId: req.params.id, studentId: req.params.studentId },
        });
        res.json({ message: 'Student unenrolled' });
    } catch (err) { next(err); }
});

export default router;
