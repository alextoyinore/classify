import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readSettings } from './settings.js';

const router = Router();
router.use(authenticate);

// GET /api/students/results/aggregate
router.get('/results/aggregate', async (req, res, next) => {
    try {
        const { departmentId, courseId, semesterId, level } = req.query;
        const studentId = req.user.role === 'STUDENT' ? req.user.student?.id : req.query.studentId;

        if (req.user.role === 'STUDENT' && !studentId) {
            return res.status(403).json({ error: 'Student profile not found' });
        }

        const settings = readSettings();
        const attendanceWeight = Number(settings.attendanceWeight) || 0;

        // 1. Determine active semester/session if not provided
        let semId = semesterId;
        if (!semId) {
            const activeSem = await prisma.semester_.findFirst({ where: { isCurrent: true } });
            semId = activeSem?.id;
        }

        if (!semId) return res.status(400).json({ error: 'No active semester found' });

        // 2. Fetch Students
        const students = await prisma.student.findMany({
            where: {
                ...(studentId && { id: studentId }),
                ...(departmentId && { departmentId }),
                ...(level && { level: Number(level) }),
            },
            include: {
                department: { select: { name: true } },
                enrollments: {
                    where: { semester: (await prisma.semester_.findUnique({ where: { id: semId } }))?.name },
                    include: { course: true }
                }
            },
            orderBy: { lastName: 'asc' }
        });

        // 3. For each student, aggregate scores
        const results = await Promise.all(students.map(async (student) => {
            const coursesData = await Promise.all(student.enrollments.map(async (enc) => {
                const cId = enc.courseId;

                // Attendance
                const [totalSessions, presentCount] = await Promise.all([
                    prisma.attendanceSession.count({
                        where: {
                            courseId: cId, semesterId: semId,
                            AND: [
                                { OR: [{ departmentId: student.departmentId }, { departmentId: null }] },
                                { OR: [{ level: student.level }, { level: null }] }
                            ]
                        }
                    }),
                    prisma.attendance.count({
                        where: { studentId: student.id, courseId: cId, semesterId: semId, status: 'PRESENT' }
                    })
                ]);

                const attendanceScore = totalSessions > 0 ? (presentCount / totalSessions) * attendanceWeight : 0;

                // Test Score (CBT where category = TEST)
                const tests = await prisma.cbtAttempt.findMany({
                    where: { studentId: student.id, exam: { courseId: cId, semesterId: semId, category: 'TEST' } },
                    include: { exam: { select: { totalMarks: true } } }
                });
                const testScore = tests.reduce((sum, t) => sum + (t.score || 0), 0);
                const testMax = tests.reduce((sum, t) => sum + (t.exam.totalMarks || 0), 0);

                // Exam Score (CBT where category = EXAM + Written)
                const [cbtExams, writtenScores] = await Promise.all([
                    prisma.cbtAttempt.findMany({
                        where: { studentId: student.id, exam: { courseId: cId, semesterId: semId, category: 'EXAM' } },
                        include: { exam: { select: { totalMarks: true } } }
                    }),
                    prisma.score.findMany({
                        where: { studentId: student.id, exam: { courseId: cId, semesterId: semId } },
                        include: { exam: { select: { totalMarks: true } } }
                    })
                ]);

                const examScore = cbtExams.reduce((sum, t) => sum + (t.score || 0), 0) + writtenScores.reduce((sum, s) => sum + (s.score || 0), 0);
                const examMax = cbtExams.reduce((sum, t) => sum + (t.exam.totalMarks || 0), 0) + writtenScores.reduce((sum, s) => sum + (s.exam.totalMarks || 0), 0);

                return {
                    courseCode: enc.course.code,
                    courseTitle: enc.course.title,
                    attendance: { present: presentCount, total: totalSessions, score: Math.round(attendanceScore * 100) / 100, weight: attendanceWeight },
                    test: { score: testScore, max: testMax },
                    exam: { score: examScore, max: examMax },
                    total: Math.round((attendanceScore + testScore + examScore) * 100) / 100
                };
            }));

            // Filter by courseId if requested (after processing all or selectively)
            const filteredCourses = courseId ? coursesData.filter(c => student.enrollments.find(e => e.courseId === courseId && e.course.code === c.courseCode)) : coursesData;

            if (courseId && filteredCourses.length === 0) return null;

            return {
                id: student.id,
                firstName: student.firstName,
                lastName: student.lastName,
                matricNumber: student.matricNumber,
                department: student.department?.name,
                level: student.level,
                courses: filteredCourses
            };
        }));

        res.json(results.filter(r => r !== null));
    } catch (err) { next(err); }
});

// GET /api/students?search=&department=&level=&page=1&limit=20
router.get('/', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { search, department, level, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            ...(department && { departmentId: department }),
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
            prisma.student.findMany({
                where, skip, take: Number(limit),
                orderBy: { lastName: 'asc' },
                include: {
                    user: { select: { email: true, isActive: true, lastLogin: true } },
                    department: { select: { name: true } },
                    faculty: { select: { name: true } }
                }
            }),
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
        const { email, password, firstName, lastName, middleName, matricNumber, gender, dateOfBirth, phone, address, departmentId, facultyId, level, entryYear } = req.body;
        if (!email || !firstName || !lastName || !matricNumber || !departmentId || !gender)
            return res.status(400).json({ error: 'Required fields missing' });

        const hashed = await bcrypt.hash(password || matricNumber, 12);
        const student = await prisma.user.create({
            data: {
                email: email.toLowerCase().trim(),
                password: hashed,
                role: 'STUDENT',
                student: {
                    create: {
                        firstName, lastName, middleName, matricNumber, gender,
                        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                        phone, address, departmentId, facultyId,
                        level: Number(level) || 100,
                        entryYear: entryYear || String(new Date().getFullYear())
                    },
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
        const { firstName, lastName, middleName, gender, dateOfBirth, phone, address, departmentId, facultyId, level, entryYear, avatarUrl, isActive } = req.body;
        const student = await prisma.student.update({
            where: { id: req.params.id },
            data: {
                firstName, lastName, middleName, gender,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                phone, address, departmentId, facultyId,
                level: level ? Number(level) : undefined,
                entryYear,
                avatarUrl
            },
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
