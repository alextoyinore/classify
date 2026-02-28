import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const computeGrade = (score, total) => {
    const pct = (score / total) * 100;
    if (pct >= 70) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 45) return 'D';
    return 'F';
};

// GET /api/exams?courseId=&semesterId=
router.get('/', async (req, res, next) => {
    try {
        const { courseId, semesterId } = req.query;
        const where = {
            ...(courseId && { courseId }),
            ...(semesterId && { semesterId }),
        };

        const [written, cbt] = await Promise.all([
            prisma.exam.findMany({
                where,
                include: {
                    course: { select: { code: true, title: true } },
                    semester: { select: { name: true, session: { select: { title: true } } } },
                    _count: { select: { scores: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.cbtExam.findMany({
                where: {
                    ...where,
                    // For instructors/admins, show all. For students, only published.
                    ...(req.user.role === 'STUDENT' && { isPublished: true })
                },
                include: {
                    course: { select: { code: true, title: true } },
                    semester: { select: { name: true, session: { select: { title: true } } } },
                    _count: { select: { attempts: true } },
                },
                orderBy: { createdAt: 'desc' },
            })
        ]);

        // Normalize and merge
        const unified = [
            ...written.map(e => ({ ...e, type: e.type || 'WRITTEN', isCbt: false })),
            ...cbt.map(e => ({ ...e, type: e.mode || 'CBT', isCbt: true }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ data: unified });
    } catch (err) { next(err); }
});

// GET /api/exams/:id
router.get('/:id', async (req, res, next) => {
    try {
        const exam = await prisma.exam.findUnique({
            where: { id: req.params.id },
            include: { course: true, semester: { include: { session: true } }, scores: { include: { student: { select: { firstName: true, lastName: true, matricNumber: true } } } } },
        });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        res.json({ exam });
    } catch (err) { next(err); }
});

// POST /api/exams
router.post('/', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const {
            courseId, semesterId, title, type, examDate, totalMarks,
            topicIds, numQuestions, category, instructions,
            durationMinutes, passMark, startWindow, endWindow, allowReview
        } = req.body;

        if (!courseId || !semesterId || !title)
            return res.status(400).json({ error: 'courseId, semesterId, and title are required' });

        if (type === 'CBT') {
            // Create a CbtExam instead
            const exam = await prisma.cbtExam.create({
                data: {
                    courseId, semesterId, title, mode: 'CBT',
                    category: category || 'EXAM',
                    instructions: instructions || '',
                    durationMinutes: Number(durationMinutes) || 60,
                    totalMarks: Number(totalMarks) || 100,
                    passMark: Number(passMark) || 50,
                    startWindow: startWindow ? new Date(startWindow) : null,
                    endWindow: endWindow ? new Date(endWindow) : null,
                    allowReview: allowReview ?? true,
                    topicIds: topicIds || [],
                    numQuestions: Number(numQuestions) || 0,
                }
            });

            // Initial pooling if settings provided
            if (topicIds?.length > 0 && numQuestions > 0) {
                const pool = await prisma.cbtQuestion.findMany({
                    where: { courseId, topicId: { in: topicIds }, isActive: true },
                    select: { id: true }
                });
                const shuffled = pool.sort(() => 0.5 - Math.random());
                const finalQuestionIds = shuffled.slice(0, Number(numQuestions)).map(q => q.id);
                await prisma.cbtExamQuestion.createMany({
                    data: finalQuestionIds.map((qId, idx) => ({ examId: exam.id, questionId: qId, order: idx + 1 })),
                });
            }

            return res.status(201).json({ exam });
        }

        const exam = await prisma.exam.create({
            data: { courseId, semesterId, title, type: type || 'WRITTEN', examDate: examDate ? new Date(examDate) : null, totalMarks: Number(totalMarks) || 100 },
        });
        res.status(201).json({ exam });
    } catch (err) { next(err); }
});

// PUT /api/exams/:id
router.put('/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { title, type, examDate, totalMarks } = req.body;
        const exam = await prisma.exam.update({
            where: { id: req.params.id },
            data: { title, type, examDate: examDate ? new Date(examDate) : undefined, totalMarks: totalMarks ? Number(totalMarks) : undefined },
        });
        res.json({ exam });
    } catch (err) { next(err); }
});

// DELETE /api/exams/:id
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        await prisma.exam.delete({ where: { id: req.params.id } });
        res.json({ message: 'Exam deleted' });
    } catch (err) { next(err); }
});

// POST /api/exams/:id/scores — bulk upsert scores
router.post('/:id/scores', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { scores } = req.body; // [{ studentId, score, remark }]
        const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        const results = await Promise.all(
            scores.map(s => {
                const grade = computeGrade(s.score, exam.totalMarks);
                return prisma.score.upsert({
                    where: { examId_studentId: { examId: req.params.id, studentId: s.studentId } },
                    create: { examId: req.params.id, studentId: s.studentId, score: s.score, grade, remark: s.remark },
                    update: { score: s.score, grade, remark: s.remark },
                });
            })
        );
        res.json({ saved: results.length });
    } catch (err) { next(err); }
});

// GET /api/exams/:id/results
router.get('/:id/results', async (req, res, next) => {
    try {
        if (req.user.role === 'STUDENT') {
            const attempt = await prisma.score.findUnique({
                where: { examId_studentId: { examId: req.params.id, studentId: req.user.student?.id } },
            });
            return res.json({ score: attempt });
        }
        const scores = await prisma.score.findMany({
            where: { examId: req.params.id },
            include: { student: { select: { firstName: true, lastName: true, matricNumber: true } } },
            orderBy: { score: 'desc' },
        });
        res.json({ scores });
    } catch (err) { next(err); }
});

export default router;
