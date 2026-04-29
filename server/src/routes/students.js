import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readSettings } from './settings.js';

const router = Router();
router.use(authenticate);

// GET /api/students/results/aggregate?page=1&limit=20
router.get('/results/aggregate', async (req, res, next) => {
    try {
        const { departmentId, courseId, semesterId, level, page = 1, limit = 20 } = req.query;
        const pageNum  = Math.max(1, parseInt(page)  || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
        const skip = (pageNum - 1) * limitNum;

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

        const activeSemRecord = await prisma.semester_.findUnique({ where: { id: semId } });

        // 2. Build student where clause
        const studentWhere = {
            ...(studentId    && { id: studentId }),
            ...(departmentId && { departmentId }),
            ...(level        && { level: Number(level) }),
        };

        // 3. Count total for pagination
        const total = await prisma.student.count({ where: studentWhere });

        // 4. Fetch paginated students
        const students = await prisma.student.findMany({
            where: studentWhere,
            skip,
            take: limitNum,
            include: {
                department: { select: { name: true } },
                enrollments: {
                    where: { semester: activeSemRecord?.name },
                    include: { course: { select: { id: true, code: true, title: true } } }
                }
            },
            orderBy: { lastName: 'asc' }
        });

        // 5. For each student, aggregate scores
        const rawResults = await Promise.all(students.map(async (student) => {
            const coursesData = await Promise.all(student.enrollments.map(async (enc) => {
                const cId = enc.courseId;

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

                const tests = await prisma.cbtAttempt.findMany({
                    where: { studentId: student.id, exam: { courseId: cId, semesterId: semId, category: 'TEST' } },
                    include: { exam: { select: { totalMarks: true } } }
                });
                const testScore = tests.reduce((sum, t) => sum + (t.score || 0), 0);
                const testMax   = tests.reduce((sum, t) => sum + (t.exam.totalMarks || 0), 0);

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
                const examMax   = cbtExams.reduce((sum, t) => sum + (t.exam.totalMarks || 0), 0) + writtenScores.reduce((sum, s) => sum + (s.exam.totalMarks || 0), 0);

                return {
                    courseId: enc.courseId,
                    courseCode: enc.course.code,
                    courseTitle: enc.course.title,
                    attendance: { present: presentCount, total: totalSessions, score: Math.round(attendanceScore * 100) / 100, weight: attendanceWeight },
                    test:  { score: testScore, max: testMax },
                    exam:  { score: examScore, max: examMax },
                    total: Math.round((attendanceScore + testScore + examScore) * 100) / 100
                };
            }));

            const filteredCourses = courseId
                ? coursesData.filter(c => c.courseId === courseId)
                : coursesData;

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

        const data = rawResults.filter(r => r !== null);
        res.json({ data, total, page: pageNum, pages: Math.ceil(total / limitNum) });
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
        const { firstName, lastName, middleName, gender, dateOfBirth, phone, address, departmentId, facultyId, level, entryYear, avatarUrl, isActive, matricNumber, email, password } = req.body;
        const student = await prisma.student.update({
            where: { id: req.params.id },
            data: {
                firstName, lastName, middleName, gender,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                phone, address, departmentId, facultyId,
                level: level ? Number(level) : undefined,
                entryYear,
                avatarUrl,
                ...(matricNumber && { matricNumber: matricNumber.toUpperCase().trim() })
            },
        });
        
        const userUpdateData = {};
        if (typeof isActive === 'boolean') userUpdateData.isActive = isActive;
        if (email) userUpdateData.email = email.toLowerCase().trim();
        if (password) {
            userUpdateData.password = await bcrypt.hash(password, 12);
        }

        if (Object.keys(userUpdateData).length > 0) {
            await prisma.user.update({ where: { id: student.userId }, data: userUpdateData });
        }
        res.json({ student, message: 'Student updated' });
    } catch (err) { 
        if (err.code === 'P2002') return res.status(409).json({ error: 'Email or matric number already exists' });
        next(err); 
    }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const student = await prisma.student.findUnique({
            where: { id },
            include: { user: true }
        });
        
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // Perform hard delete of student and all associated records in a transaction
        await prisma.$transaction(async (tx) => {
            // 1. Delete CBT related data
            // Clear replies to messages that might be deleted next (to avoid FK constraints)
            await tx.message.updateMany({
                where: { replyTo: { OR: [{ senderId: student.userId }, { receiverId: student.userId }] } },
                data: { replyToId: null }
            });
            
            await tx.cbtAnswer.deleteMany({ where: { attempt: { studentId: id } } });
            await tx.cbtAttempt.deleteMany({ where: { studentId: id } });
            
            // 2. Delete main academic records
            await tx.score.deleteMany({ where: { studentId: id } });
            await tx.attendance.deleteMany({ where: { studentId: id } });
            await tx.enrollment.deleteMany({ where: { studentId: id } });
            
            // 3. Delete messages
            await tx.message.deleteMany({
                where: { OR: [{ senderId: student.userId }, { receiverId: student.userId }] }
            });
            
            // 4. Cleanup any sync logs triggered by this student
            await tx.syncLog.deleteMany({ where: { triggeredBy: student.userId } });

            // 5. Delete student profile
            await tx.student.delete({ where: { id } });
            
            // 6. Delete user account
            await tx.user.delete({ where: { id: student.userId } });
        });

        res.json({ message: 'Student and all related data deleted permanently' });
    } catch (err) { 
        console.error('Hard delete error:', err);
        next(err); 
    }
});

// POST /api/students/:id/reset-password
router.post('/:id/reset-password', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const student = await prisma.student.findUnique({ where: { id: req.params.id } });
        if (!student) return res.status(404).json({ error: 'Student not found' });
        
        const defaultPassword = student.matricNumber.toUpperCase().trim();
        const hashed = await bcrypt.hash(defaultPassword, 12);
        
        await prisma.user.update({
            where: { id: student.userId },
            data: { password: hashed }
        });
        
        res.json({ message: `Password reset to defaults`, defaultPassword });
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
