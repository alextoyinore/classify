import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/students?search=&department=&level=&page=1&limit=20
router.get('/', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { search, department, level, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            ...(department && { department }),
            ...(level && { level: Number(level) }),
            ...(search && {
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { matricNumber: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };
        const [students, total] = await Promise.all([
            prisma.student.findMany({ where, skip, take: Number(limit), orderBy: { lastName: 'asc' }, include: { user: { select: { email: true, isActive: true, lastLogin: true } } } }),
            prisma.student.count({ where }),
        ]);
        res.json({ data: students, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) { next(err); }
});

// GET /api/students/:id
router.get('/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const student = await prisma.student.findUnique({
            where: { id: req.params.id },
            include: {
                user: { select: { email: true, isActive: true, lastLogin: true } },
                enrollments: { include: { course: true } },
                scores: { include: { exam: { include: { course: true } } } },
                cbtAttempts: { include: { exam: { include: { course: true } } } },
            },
        });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json({ student });
    } catch (err) { next(err); }
});

// POST /api/students — create student + user account
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, middleName, matricNumber, gender, dateOfBirth, phone, address, department, faculty, level, entryYear } = req.body;
        if (!email || !firstName || !lastName || !matricNumber || !department || !gender)
            return res.status(400).json({ error: 'Required fields missing' });

        const hashed = await bcrypt.hash(password || matricNumber, 12);
        const student = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                password: hashed,
                role: 'STUDENT',
                student: {
                    create: { firstName, lastName, middleName, matricNumber, gender, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null, phone, address, department, faculty, level: Number(level) || 100, entryYear: entryYear || String(new Date().getFullYear()) },
                },
            },
            include: { student: true },
        });
        res.status(201).json({ student: student.student, message: 'Student created successfully' });
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Email or matric number already exists' });
        next(err);
    }
});

// PUT /api/students/:id
router.put('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { firstName, lastName, middleName, phone, address, department, faculty, level, avatarUrl, isActive } = req.body;
        const student = await prisma.student.update({
            where: { id: req.params.id },
            data: { firstName, lastName, middleName, phone, address, department, faculty, level: level ? Number(level) : undefined, avatarUrl },
        });
        if (typeof isActive === 'boolean') {
            await prisma.user.update({ where: { id: student.userId }, data: { isActive } });
        }
        res.json({ student, message: 'Student updated' });
    } catch (err) { next(err); }
});

// DELETE /api/students/:id (soft delete)
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const student = await prisma.student.findUnique({ where: { id: req.params.id } });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        await prisma.user.update({ where: { id: student.userId }, data: { isActive: false } });
        res.json({ message: 'Student deactivated' });
    } catch (err) { next(err); }
});

// GET /api/students/:id/attendance?courseId=&semesterId=
router.get('/:id/attendance', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, semesterId } = req.query;
        const records = await prisma.attendance.findMany({
            where: { studentId: req.params.id, ...(courseId && { courseId }), ...(semesterId && { semesterId }) },
            include: { course: { select: { code: true, title: true } } },
            orderBy: { date: 'desc' },
        });
        const summary = {
            total: records.length,
            present: records.filter(r => r.status === 'PRESENT').length,
            absent: records.filter(r => r.status === 'ABSENT').length,
            late: records.filter(r => r.status === 'LATE').length,
        };
        res.json({ records, summary });
    } catch (err) { next(err); }
});

// GET /api/students/:id/transcript
router.get('/:id/transcript', authenticate, async (req, res, next) => {
    try {
        // Students can only view own transcript
        if (req.user.role === 'STUDENT' && req.user.student?.id !== req.params.id)
            return res.status(403).json({ error: 'Access denied' });

        const scores = await prisma.score.findMany({
            where: { studentId: req.params.id },
            include: { exam: { include: { course: true, semester: { include: { session: true } } } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json({ scores });
    } catch (err) { next(err); }
});

export default router;
