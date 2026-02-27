import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/courses
router.get('/', async (req, res, next) => {
    try {
        const { search, department, level, semester, page = 1, limit = 100 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            isActive: true,
            ...(department && { departments: { some: { name: department } } }),
            ...(level && { levels: { has: Number(level) } }),
            ...(semester && { semesters: { has: semester } }),
            ...(search && {
                OR: [
                    { code: { contains: search, mode: 'insensitive' } },
                    { title: { contains: search, mode: 'insensitive' } },
                ],
            }),
            ...(req.user.role === 'STUDENT' && {
                enrollments: { some: { studentId: req.user.student.id } }
            })
        };
        const [courses, total] = await Promise.all([
            prisma.course.findMany({
                where, skip, take: Number(limit), orderBy: { code: 'asc' },
                include: {
                    departments: true,
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
                departments: true,
                instructors: { include: { instructor: true } },
                topics: { orderBy: { order: 'asc' } },
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
        const isStudent = req.user.role === 'STUDENT';
        const enrollments = await prisma.enrollment.findMany({
            where: {
                courseId: req.params.id,
                ...(isStudent && { student: { departmentId: req.user.student.departmentId } })
            },
            include: {
                student: {
                    include: {
                        user: { select: { email: true } }
                    }
                }
            },
            orderBy: { student: { lastName: 'asc' } },
        });

        // Add "In Class" status based on today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const attendance = await prisma.attendance.findMany({
            where: {
                courseId: req.params.id,
                date: today,
                status: 'PRESENT'
            },
            select: { studentId: true }
        });

        const presentStudentIds = new Set(attendance.map(a => a.studentId));

        const data = enrollments.map(e => {
            const studentData = {
                id: e.id,
                session: e.session,
                semester: e.semester,
                student: {
                    id: e.student.id,
                    firstName: e.student.firstName,
                    lastName: e.student.lastName,
                    matricNumber: e.student.matricNumber,
                    level: e.student.level,
                    isInClass: presentStudentIds.has(e.studentId)
                }
            };

            // If requester is a student, hide email and other potentially private info
            if (!isStudent) {
                studentData.student.user = e.student.user;
            }

            return studentData;
        });

        res.json(data);
    } catch (err) { next(err); }
});

// POST /api/courses
router.post('/', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { code, title, description, creditUnits } = req.body;
        if (!title)
            return res.status(400).json({ error: 'Title is required' });
        const course = await prisma.course.create({
            data: {
                code: code ? code.toUpperCase() : null,
                title,
                description,
                creditUnits: creditUnits ? Number(creditUnits) : null
            },
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
        const { title, description, creditUnits, levels, semesters, departmentIds, isActive, code } = req.body;

        const updateData = { title, description, isActive };
        if (code !== undefined) updateData.code = code ? code.toUpperCase() : null;
        if (creditUnits !== undefined) updateData.creditUnits = creditUnits ? Number(creditUnits) : null;
        if (levels !== undefined) updateData.levels = levels.map(Number);
        if (semesters !== undefined) updateData.semesters = semesters;
        if (departmentIds !== undefined) {
            updateData.departments = { set: departmentIds.map(id => ({ id })) };
        }

        const course = await prisma.course.update({
            where: { id: req.params.id },
            data: updateData,
            include: { departments: true }
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

// --- Curriculum (Topics) Endpoints ---

// POST /api/courses/:id/topics
router.post('/:id/topics', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { title, description } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required for a topic' });

        const count = await prisma.courseTopic.count({ where: { courseId: req.params.id } });
        const topic = await prisma.courseTopic.create({
            data: {
                courseId: req.params.id,
                title,
                description,
                order: count + 1
            }
        });
        res.status(201).json(topic);
    } catch (err) { next(err); }
});

// PUT /api/courses/:id/topics/:topicId
router.put('/:id/topics/:topicId', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { title, description, order } = req.body;
        const topic = await prisma.courseTopic.update({
            where: { id: req.params.topicId },
            data: { title, description, order: order ? Number(order) : undefined }
        });
        res.json(topic);
    } catch (err) { next(err); }
});

// DELETE /api/courses/:id/topics/:topicId
router.delete('/:id/topics/:topicId', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        await prisma.courseTopic.delete({ where: { id: req.params.topicId } });
        res.json({ message: 'Topic deleted' });
    } catch (err) { next(err); }
});

// --- End Curriculum Endpoints ---

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

// POST /api/courses/:id/auto-enroll — auto-enroll based on assignments
router.post('/:id/auto-enroll', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { session, semester } = req.body;
        if (!session || !semester) return res.status(400).json({ error: 'Session and semester are required' });

        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: { departments: true }
        });

        if (!course) return res.status(404).json({ error: 'Course not found' });

        const students = await prisma.student.findMany({
            where: {
                isActive: true,
                level: { in: course.levels },
                departmentId: { in: course.departments.map(d => d.id) }
            },
            select: { id: true }
        });

        if (students.length === 0) {
            return res.json({ enrolled: 0, message: 'No matching students found' });
        }

        const data = students.map(s => ({
            studentId: s.id,
            courseId: course.id,
            session,
            semester
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
