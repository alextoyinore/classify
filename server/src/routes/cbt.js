import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ─── Question Bank ────────────────────────────────────────────────────────────

// GET /api/cbt/questions?courseId=&difficulty=
router.get('/questions', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, difficulty, page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            isActive: true,
            ...(courseId && { courseId }),
            ...(difficulty && { difficulty }),
        };
        const [data, total] = await Promise.all([
            prisma.cbtQuestion.findMany({
                where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
                include: { course: { select: { code: true, title: true } } },
            }),
            prisma.cbtQuestion.count({ where }),
        ]);
        res.json({ data, total });
    } catch (err) { next(err); }
});

// POST /api/cbt/questions
router.post('/questions', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, questionText, optionA, optionB, optionC, optionD, correctOption, explanation, marks, difficulty } = req.body;
        if (!courseId || !questionText || !optionA || !optionB || !optionC || !optionD || !correctOption)
            return res.status(400).json({ error: 'All question fields are required' });
        if (!['A', 'B', 'C', 'D'].includes(correctOption.toUpperCase()))
            return res.status(400).json({ error: 'correctOption must be A, B, C, or D' });

        const q = await prisma.cbtQuestion.create({
            data: { courseId, questionText, optionA, optionB, optionC, optionD, correctOption: correctOption.toUpperCase(), explanation, marks: Number(marks) || 1, difficulty },
        });
        res.status(201).json({ question: q });
    } catch (err) { next(err); }
});

// PUT /api/cbt/questions/:id
router.put('/questions/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { questionText, optionA, optionB, optionC, optionD, correctOption, explanation, marks, difficulty, isActive } = req.body;
        const q = await prisma.cbtQuestion.update({
            where: { id: req.params.id },
            data: { questionText, optionA, optionB, optionC, optionD, correctOption: correctOption?.toUpperCase(), explanation, marks: marks ? Number(marks) : undefined, difficulty, isActive },
        });
        res.json({ question: q });
    } catch (err) { next(err); }
});

// DELETE /api/cbt/questions/:id (soft)
router.delete('/questions/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        await prisma.cbtQuestion.update({ where: { id: req.params.id }, data: { isActive: false } });
        res.json({ message: 'Question removed from bank' });
    } catch (err) { next(err); }
});

// ─── CBT Exams ────────────────────────────────────────────────────────────────

// GET /api/cbt/exams?courseId=&semesterId=&published=
router.get('/exams', async (req, res, next) => {
    try {
        const { courseId, semesterId, published } = req.query;
        const where = {
            ...(courseId && { courseId }),
            ...(semesterId && { semesterId }),
            ...(published === 'true' && { isPublished: true }),
            ...(req.user.role === 'STUDENT' && { isPublished: true }),
        };
        const exams = await prisma.cbtExam.findMany({
            where, orderBy: { createdAt: 'desc' },
            include: {
                course: { select: { code: true, title: true } },
                questions: { select: { id: true } },
                _count: { select: { attempts: true } },
            },
        });

        if (req.user.role === 'STUDENT' && req.user.student) {
            const attempts = await prisma.cbtAttempt.findMany({
                where: { studentId: req.user.student.id, examId: { in: exams.map(e => e.id) } },
                select: { examId: true, isCompleted: true, score: true, percentage: true },
            });
            const attemptMap = Object.fromEntries(attempts.map(a => [a.examId, a]));
            return res.json({ data: exams.map(e => ({ ...e, myAttempt: attemptMap[e.id] || null })), total: exams.length });
        }
        res.json({ data: exams, total: exams.length });
    } catch (err) { next(err); }
});

// GET /api/cbt/exams/:id
router.get('/exams/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const exam = await prisma.cbtExam.findUnique({
            where: { id: req.params.id },
            include: {
                course: { select: { code: true, title: true } },
                questions: { include: { question: true }, orderBy: { order: 'asc' } },
            },
        });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        res.json(exam);
    } catch (err) { next(err); }
});

// POST /api/cbt/exams — create exam and attach questions
router.post('/exams', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, semesterId, title, instructions, durationMinutes, totalMarks, passMark, startWindow, endWindow, allowReview, questionIds } = req.body;
        if (!courseId || !semesterId || !title)
            return res.status(400).json({ error: 'courseId, semesterId, and title are required' });

        const exam = await prisma.cbtExam.create({
            data: {
                courseId, semesterId, title, instructions,
                durationMinutes: Number(durationMinutes) || 60,
                totalMarks: Number(totalMarks) || questionIds.length,
                passMark: Number(passMark) || 50,
                startWindow: startWindow ? new Date(startWindow) : null,
                endWindow: endWindow ? new Date(endWindow) : null,
                allowReview: allowReview ?? true,
                questions: {
                    create: questionIds.map((qId, idx) => ({ questionId: qId, order: idx + 1 })),
                },
            },
            include: { questions: { include: { question: true } } },
        });
        res.status(201).json({ exam });
    } catch (err) { next(err); }
});

// PUT /api/cbt/exams/:id — general update (title, duration, publish, etc.)
router.put('/exams/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { title, instructions, durationMinutes, totalMarks, passMark,
            startWindow, endWindow, allowReview, isPublished } = req.body;
        const exam = await prisma.cbtExam.update({
            where: { id: req.params.id },
            data: {
                ...(title !== undefined && { title }),
                ...(instructions !== undefined && { instructions }),
                ...(durationMinutes !== undefined && { durationMinutes: Number(durationMinutes) }),
                ...(totalMarks !== undefined && { totalMarks: Number(totalMarks) }),
                ...(passMark !== undefined && { passMark: Number(passMark) }),
                ...(startWindow !== undefined && { startWindow: startWindow ? new Date(startWindow) : null }),
                ...(endWindow !== undefined && { endWindow: endWindow ? new Date(endWindow) : null }),
                ...(allowReview !== undefined && { allowReview: Boolean(allowReview) }),
                ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
            },
        });
        res.json({ exam });
    } catch (err) { next(err); }
});

// POST /api/cbt/exams/:id/questions — assign/replace question set
router.post('/exams/:id/questions', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { questionIds } = req.body;
        if (!Array.isArray(questionIds)) return res.status(400).json({ error: 'questionIds must be an array' });

        // Replace existing question assignments
        await prisma.cbtExamQuestion.deleteMany({ where: { examId: req.params.id } });
        if (questionIds.length) {
            await prisma.cbtExamQuestion.createMany({
                data: questionIds.map((qId, idx) => ({ examId: req.params.id, questionId: qId, order: idx + 1 })),
            });
        }
        res.json({ assigned: questionIds.length });
    } catch (err) { next(err); }
});

// DELETE /api/cbt/exams/:id
router.delete('/exams/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        await prisma.cbtExam.delete({ where: { id: req.params.id } });
        res.json({ message: 'CBT exam deleted' });
    } catch (err) { next(err); }
});

// ─── Student Exam Flow ────────────────────────────────────────────────────────

// POST /api/cbt/exams/:id/start — student starts an attempt
router.post('/exams/:id/start', requireRole('STUDENT'), async (req, res, next) => {
    try {
        const studentId = req.user.student?.id;
        if (!studentId) return res.status(400).json({ error: 'No student profile found' });

        const exam = await prisma.cbtExam.findUnique({
            where: { id: req.params.id },
            include: {
                questions: {
                    include: { question: { select: { id: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, marks: true } } },
                    orderBy: { order: 'asc' },
                },
            },
        });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        if (!exam.isPublished) return res.status(403).json({ error: 'Exam is not yet available' });

        // Check time window
        const now = new Date();
        if (exam.startWindow && now < exam.startWindow) return res.status(403).json({ error: 'Exam has not started yet' });
        if (exam.endWindow && now > exam.endWindow) return res.status(403).json({ error: 'Exam window has closed' });

        // Check for existing attempt
        const existing = await prisma.cbtAttempt.findUnique({
            where: { examId_studentId: { examId: exam.id, studentId } },
        });
        if (existing?.isCompleted) return res.status(409).json({ error: 'You have already completed this exam' });
        if (existing) return res.json({ attempt: existing, questions: exam.questions.map(q => q.question) });

        const attempt = await prisma.cbtAttempt.create({
            data: { examId: exam.id, studentId, ipAddress: req.ip },
        });

        res.json({
            attempt: { id: attempt.id, startedAt: attempt.startedAt, durationMinutes: exam.durationMinutes },
            questions: exam.questions.map(q => q.question),
            exam: { title: exam.title, instructions: exam.instructions, durationMinutes: exam.durationMinutes, totalMarks: exam.totalMarks },
        });
    } catch (err) { next(err); }
});

// POST /api/cbt/attempts/:id/submit — submit answers and auto-grade
router.post('/attempts/:id/submit', requireRole('STUDENT'), async (req, res, next) => {
    try {
        const { answers } = req.body; // [{ questionId, selected }]
        const studentId = req.user.student?.id;

        const attempt = await prisma.cbtAttempt.findUnique({
            where: { id: req.params.id },
            include: { exam: { include: { questions: { include: { question: { select: { id: true, correctOption: true, marks: true } } } } } } },
        });
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
        if (attempt.studentId !== studentId) return res.status(403).json({ error: 'Forbidden' });
        if (attempt.isCompleted) return res.status(409).json({ error: 'Already submitted' });

        // Grade answers
        let totalScore = 0;
        const questionMap = Object.fromEntries(attempt.exam.questions.map(q => [q.question.id, q.question]));

        const answerData = answers.map(a => {
            const question = questionMap[a.questionId];
            const isCorrect = question && a.selected === question.correctOption;
            if (isCorrect) totalScore += question.marks;
            return { attemptId: attempt.id, questionId: a.questionId, selected: a.selected || null, isCorrect: isCorrect || false };
        });

        await prisma.cbtAnswer.createMany({ data: answerData, skipDuplicates: true });

        const percentage = (totalScore / attempt.exam.totalMarks) * 100;
        const updatedAttempt = await prisma.cbtAttempt.update({
            where: { id: attempt.id },
            data: { submittedAt: new Date(), isCompleted: true, score: totalScore, percentage: Math.round(percentage * 100) / 100, isPassed: percentage >= attempt.exam.passMark },
        });

        res.json({
            score: totalScore,
            totalMarks: attempt.exam.totalMarks,
            percentage: updatedAttempt.percentage,
            isPassed: updatedAttempt.isPassed,
            message: 'Exam submitted successfully',
        });
    } catch (err) { next(err); }
});

// GET /api/cbt/attempts/:id/result
router.get('/attempts/:id/result', authenticate, async (req, res, next) => {
    try {
        const attempt = await prisma.cbtAttempt.findUnique({
            where: { id: req.params.id },
            include: {
                exam: { select: { title: true, totalMarks: true, passMark: true, allowReview: true, course: { select: { code: true, title: true } } } },
                answers: {
                    include: {
                        question: { select: { questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOption: true, explanation: true } },
                    },
                },
            },
        });
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

        const studentId = req.user.student?.id;
        if (req.user.role === 'STUDENT' && attempt.studentId !== studentId)
            return res.status(403).json({ error: 'Access denied' });

        // Hide answers if review not allowed
        if (!attempt.exam.allowReview && req.user.role === 'STUDENT')
            return res.json({ attempt: { ...attempt, answers: [] }, answers: [] });

        res.json({ attempt, answers: attempt.answers });
    } catch (err) { next(err); }
});

// GET /api/cbt/exams/:id/results — admin sees all attempts
router.get('/exams/:id/results', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const attempts = await prisma.cbtAttempt.findMany({
            where: { examId: req.params.id, isCompleted: true },
            include: { student: { select: { firstName: true, lastName: true, matricNumber: true } } },
            orderBy: { percentage: 'desc' },
        });
        res.json({ attempts });
    } catch (err) { next(err); }
});

export default router;
