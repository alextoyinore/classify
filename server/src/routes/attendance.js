import { Router } from 'express';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ─── SESSIONS (Instructors/Admins) ───────────────────────────

// POST /api/attendance/session — Start a class session
router.post('/session', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, semesterId, departmentId, level } = req.body;
        if (!courseId || !semesterId) return res.status(400).json({ error: 'courseId and semesterId required' });

        // Deactivate existing sessions for this course, department, and level
        await prisma.attendanceSession.updateMany({
            where: { 
                courseId, 
                departmentId: departmentId || null,
                level: level ? parseInt(level) : null,
                isActive: true 
            },
            data: { isActive: false }
        });

        const session = await prisma.attendanceSession.create({
            data: {
                courseId,
                semesterId,
                departmentId: departmentId || null,
                level: level ? parseInt(level) : null,
                isActive: true,
                expiresAt: new Date(Date.now() + 90 * 60 * 1000) // 90 minutes from now
            }
        });
        res.status(201).json(session);
    } catch (err) { next(err); }
});

router.put('/session/:id/end', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const session = await prisma.attendanceSession.update({
            where: { id: req.params.id },
            data: { isActive: false }
        });
        res.json(session);
    } catch (err) { next(err); }
});

// PUT /api/attendance/session/:id/extend — Extend a class session
router.put('/session/:id/extend', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { minutes = 30 } = req.body;
        const session = await prisma.attendanceSession.findUnique({ where: { id } });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        const currentExpiry = session.expiresAt ? new Date(session.expiresAt).getTime() : Date.now();
        const newExpiry = new Date(currentExpiry + (minutes * 60 * 1000));

        const updated = await prisma.attendanceSession.update({
            where: { id },
            data: { expiresAt: newExpiry, isActive: true }
        });
        res.json(updated);
    } catch (err) { next(err); }
});

// GET /api/attendance/sessions — List sessions for a course
router.get('/sessions', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId } = req.query;
        const sessions = await prisma.attendanceSession.findMany({
            where: { courseId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(sessions);
    } catch (err) { next(err); }
});

// ─── SELF-MARKING (Students) ────────────────────────────────

// GET /api/attendance/active-sessions — Check for active class sessions
router.get('/active-sessions', async (req, res, next) => {
    try {
        if (req.user.role !== 'STUDENT') {
            const sessions = await prisma.attendanceSession.findMany({
                where: { 
                    isActive: true,
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } }
                    ]
                },
                include: {
                    course: { select: { code: true, title: true } },
                    department: { select: { name: true } }
                }
            });
            return res.json(sessions);
        }

        const student = req.user.student;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Find sessions that ARE active and MATCH student dept/level
        const sessions = await prisma.attendanceSession.findMany({
            where: {
                isActive: true,
                course: { enrollments: { some: { studentId: student.id } } },
                AND: [
                    { OR: [{ departmentId: student.departmentId }, { departmentId: null }] },
                    { OR: [{ level: student.level }, { level: null }] }
                ],
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            },
            include: {
                course: { select: { code: true, title: true } },
                department: { select: { name: true } }
            }
        });

        // 2. Filter out sessions where the student has ALREADY marked attendance for today
        const attendanceRecords = await prisma.attendance.findMany({
            where: {
                studentId: student.id,
                date: today,
                courseId: { in: sessions.map(s => s.courseId) }
            },
            select: { courseId: true }
        });

        const attendedCourseIds = new Set(attendanceRecords.map(r => r.courseId));
        const filteredSessions = sessions.filter(s => !attendedCourseIds.has(s.courseId));

        res.json(filteredSessions);
    } catch (err) { next(err); }
});

// POST /api/attendance/self-mark — Student self-marks attendance
router.post('/self-mark', requireRole('STUDENT'), async (req, res, next) => {
    try {
        const { courseId, semesterId } = req.body;
        const studentId = req.user.student.id;

        const student = req.user.student;
        const activeSession = await prisma.attendanceSession.findFirst({
            where: { 
                courseId, 
                semesterId, 
                isActive: true,
                course: { enrollments: { some: { studentId: student.id } } },
                AND: [
                    { OR: [{ departmentId: student.departmentId }, { departmentId: null }] },
                    { OR: [{ level: student.level }, { level: null }] }
                ],
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            }
        });

        if (!activeSession) {
            return res.status(403).json({ error: 'No active session found for your profile in this course' });
        }



        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const record = await prisma.attendance.upsert({
            where: { studentId_courseId_date: { studentId, courseId, date: today } },
            create: {
                studentId,
                courseId,
                semesterId,
                date: today,
                status: 'PRESENT',
                note: 'Self-marked',
                markedById: req.user.id
            },
            update: { status: 'PRESENT', note: 'Self-marked', markedById: req.user.id }
        });

        res.json({ message: 'Attendance marked successfully', record });
    } catch (err) { next(err); }
});

// ─── ADMIN/INSTRUCTOR TOOLS ──────────────────────────────────

// POST /api/attendance/mark — bulk mark attendance for a session
router.post('/mark', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, semesterId, date, records } = req.body;
        if (!courseId || !semesterId || !date || !records?.length)
            return res.status(400).json({ error: 'courseId, semesterId, date, and records are required' });

        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        const data = records.map(r => ({
            studentId: r.studentId,
            courseId,
            semesterId,
            date: attendanceDate,
            status: r.status || 'PRESENT',
            note: r.note || null,
            markedById: req.user.id,
        }));

        const results = await Promise.all(
            data.map(d =>
                prisma.attendance.upsert({
                    where: { studentId_courseId_date: { studentId: d.studentId, courseId: d.courseId, date: d.date } },
                    create: d,
                    update: { status: d.status, note: d.note, markedById: d.markedById },
                })
            )
        );
        res.json({ marked: results.length, message: 'Attendance saved' });
    } catch (err) { next(err); }
});

// GET /api/attendance/report?courseId=&semesterId=&date=&studentId=
router.get('/report', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, semesterId, date, studentId } = req.query;
        const where = {
            ...(courseId && { courseId }),
            ...(semesterId && { semesterId }),
            ...(studentId && { studentId }),
            ...(date && { date: new Date(date) }),
        };
        const records = await prisma.attendance.findMany({
            where,
            include: {
                student: { select: { id: true, firstName: true, lastName: true, matricNumber: true } },
                course: { select: { id: true, code: true, title: true } },
            },
            orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
        });

        const summary = {};
        for (const r of records) {
            const key = r.studentId;
            if (!summary[key]) summary[key] = { student: r.student, PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, total: 0 };
            summary[key][r.status]++;
            summary[key].total++;
        }
        res.json({ records, summary: Object.values(summary) });
    } catch (err) { next(err); }
});

// GET /api/attendance/export
router.get('/export', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, semesterId } = req.query;
        const records = await prisma.attendance.findMany({
            where: { ...(courseId && { courseId }), ...(semesterId && { semesterId }) },
            include: {
                student: { select: { firstName: true, lastName: true, matricNumber: true } },
                course: { select: { code: true } },
            },
            orderBy: [{ date: 'asc' }, { student: { lastName: 'asc' } }],
        });

        const rows = records.map(r => ({
            'Matric No.': r.student.matricNumber,
            'Last Name': r.student.lastName,
            'First Name': r.student.firstName,
            'Course': r.course.code,
            'Date': r.date.toISOString().split('T')[0],
            'Status': r.status,
            'Note': r.note || '',
        }));

        const csv = stringify(rows, { header: true });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
        res.send(csv);
    } catch (err) { next(err); }
});

// GET /api/attendance/dates
router.get('/dates', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, semesterId } = req.query;
        const dates = await prisma.attendance.findMany({
            where: { courseId, semesterId },
            select: { date: true },
            distinct: ['date'],
            orderBy: { date: 'asc' },
        });
        res.json({ dates: dates.map(d => d.date) });
    } catch (err) { next(err); }
});

export default router;
