import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readSettings } from './settings.js';

const router = Router();
router.use(authenticate);

// ─── Question Bank ────────────────────────────────────────────────────────────

// GET /api/cbt/questions?courseId=&difficulty=
router.get('/questions', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, difficulty, topicId, page = 1, limit = 50 } = req.query;
        const topicIds = req.query.topicIds || req.query['topicIds[]'];
        const skip = (Number(page) - 1) * Number(limit);

        // Handle both single topicId and array topicIds
        const tIds = topicIds ? (Array.isArray(topicIds) ? topicIds : [topicIds]) : (topicId ? [topicId] : null);

        const where = {
            isActive: true,
            ...(courseId && { courseId }),
            ...(difficulty && { difficulty }),
            ...(tIds && { topicId: { in: tIds } }),
        };
        const [data, total] = await Promise.all([
            prisma.cbtQuestion.findMany({
                where, skip, take: Number(limit), orderBy: { createdAt: 'desc' },
                include: {
                    course: { select: { code: true, title: true } },
                    topic: { select: { id: true, title: true } },
                },
            }),
            prisma.cbtQuestion.count({ where }),
        ]);
        res.json({ data, total });
    } catch (err) { next(err); }
});

// POST /api/cbt/questions
router.post('/questions', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, topicId, questionText, optionA, optionB, optionC, optionD, correctOption, explanation, marks, difficulty } = req.body;
        if (!courseId || !questionText || !optionA || !optionB || !optionC || !optionD || !correctOption)
            return res.status(400).json({ error: 'All question fields are required' });
        if (!['A', 'B', 'C', 'D'].includes(correctOption.toUpperCase()))
            return res.status(400).json({ error: 'correctOption must be A, B, C, or D' });

        const q = await prisma.cbtQuestion.create({
            data: { courseId, topicId, questionText, optionA, optionB, optionC, optionD, correctOption: correctOption.toUpperCase(), explanation, marks: Number(marks) || 1, difficulty },
        });
        res.status(201).json({ question: q });
    } catch (err) { next(err); }
});

// PUT /api/cbt/questions/:id
router.put('/questions/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { questionText, optionA, optionB, optionC, optionD, correctOption, explanation, marks, difficulty, isActive, topicId } = req.body;
        const q = await prisma.cbtQuestion.update({
            where: { id: req.params.id },
            data: { questionText, optionA, optionB, optionC, optionD, correctOption: correctOption?.toUpperCase(), explanation, marks: marks ? Number(marks) : undefined, difficulty, isActive, topicId },
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

// DELETE /api/cbt/questions/topic/:topicId (hard delete for replacement)
router.delete('/questions/topic/:topicId', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        await prisma.cbtQuestion.deleteMany({
            where: { topicId: req.params.topicId }
        });
        res.json({ message: 'All questions in topic deleted' });
    } catch (err) { next(err); }
});

// POST /api/cbt/questions/batch — batch upload questions
router.post('/questions/batch', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { courseId, topicId, questions } = req.body;
        if (!courseId || !Array.isArray(questions))
            return res.status(400).json({ error: 'courseId and questions array are required' });

        const data = questions.map(q => ({
            courseId,
            topicId: q.topicId || topicId,
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption?.toUpperCase(),
            explanation: q.explanation,
            marks: Number(q.marks) || 1,
            difficulty: q.difficulty || 'MEDIUM',
        }));

        const result = await prisma.cbtQuestion.createMany({ data });
        res.json({ count: result.count });
    } catch (err) { next(err); }
});

// ─── CBT Exams ────────────────────────────────────────────────────────────────

// GET /api/cbt/exams?courseId=&semesterId=&published=
router.get('/exams', async (req, res, next) => {
    try {
        const { courseId, semesterId, published } = req.query;
        const where = {
            isArchived: false,
            deletionScheduledAt: null,
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
            const student = req.user.student;
            const attempts = await prisma.cbtAttempt.findMany({
                where: { studentId: student.id, examId: { in: exams.map(e => e.id) } },
                select: { examId: true, isCompleted: true, score: true, percentage: true },
            });
            const attemptMap = Object.fromEntries(attempts.map(a => [a.examId, a]));

            // Check for active attendance sessions for these exams
            const activeSessions = await prisma.attendanceSession.findMany({
                where: {
                    isActive: true,
                    semesterId: { in: exams.map(e => e.semesterId) },
                    courseId: { in: exams.map(e => e.courseId) },
                    AND: [
                        { OR: [{ departmentId: student.departmentId }, { departmentId: null }] },
                        { OR: [{ level: student.level }, { level: null }] }
                    ]
                },
                select: { courseId: true, semesterId: true }
            });

            const sessionSet = new Set(activeSessions.map(s => `${s.courseId}-${s.semesterId}`));

            return res.json({
                data: exams.map(e => ({
                    ...e,
                    myAttempt: attemptMap[e.id] || null,
                    isSessionActive: sessionSet.has(`${e.courseId}-${e.semesterId}`)
                })),
                total: exams.length
            });
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
        const { courseId, semesterId, title, category, mode, instructions, durationMinutes, totalMarks, passMark, startWindow, endWindow, allowReview, questionIds, topicIds, numQuestions } = req.body;
        if (!courseId || !semesterId || !title)
            return res.status(400).json({ error: 'courseId, semesterId, and title are required' });

        let finalQuestionIds = questionIds || [];

        // Auto-pooling logic
        if (topicIds && numQuestions && (!questionIds || questionIds.length === 0)) {
            const pool = await prisma.cbtQuestion.findMany({
                where: {
                    courseId,
                    topicId: { in: topicIds },
                    isActive: true
                },
                select: { id: true }
            });

            // Shuffle and pick
            const shuffled = pool.sort(() => 0.5 - Math.random());
            finalQuestionIds = shuffled.slice(0, numQuestions).map(q => q.id);
        }

        const exam = await prisma.cbtExam.create({
            data: {
                courseId, semesterId, title, category, mode, instructions,
                durationMinutes: Number(durationMinutes) || 60,
                totalMarks: Number(totalMarks) || finalQuestionIds.length,
                passMark: Number(passMark) || 50,
                startWindow: startWindow ? new Date(startWindow) : null,
                endWindow: endWindow ? new Date(endWindow) : null,
                allowReview: allowReview ?? true,
                topicIds: topicIds || [],
                numQuestions: numQuestions ? Number(numQuestions) : finalQuestionIds.length,
                questions: {
                    create: finalQuestionIds.map((qId, idx) => ({ questionId: qId, order: idx + 1 })),
                },
            },
            include: { questions: { include: { question: true } } },
        });
        res.status(201).json({ exam });
    } catch (err) { next(err); }
});

// PUT /api/cbt/exams/:id — general update
router.put('/exams/:id', requireRole('ADMIN', 'INSTRUCTOR'), async (req, res, next) => {
    try {
        const { title, category, mode, instructions, durationMinutes, totalMarks, passMark,
            startWindow, endWindow, allowReview, isPublished, topicIds, numQuestions } = req.body;
        const exam = await prisma.cbtExam.update({
            where: { id: req.params.id },
            data: {
                ...(title !== undefined && { title }),
                ...(category !== undefined && { category }),
                ...(mode !== undefined && { mode }),
                ...(instructions !== undefined && { instructions }),
                ...(durationMinutes !== undefined && { durationMinutes: Number(durationMinutes) }),
                ...(totalMarks !== undefined && { totalMarks: Number(totalMarks) }),
                ...(passMark !== undefined && { passMark: Number(passMark) }),
                ...(startWindow !== undefined && { startWindow: startWindow ? new Date(startWindow) : null }),
                ...(endWindow !== undefined && { endWindow: endWindow ? new Date(endWindow) : null }),
                ...(allowReview !== undefined && { allowReview: Boolean(allowReview) }),
                ...(isPublished !== undefined && { isPublished: Boolean(isPublished) }),
                ...(topicIds !== undefined && { topicIds }),
                ...(numQuestions !== undefined && { numQuestions: Number(numQuestions) }),
            },
        });

        // If pooling settings changed, we might want to re-pool
        // For now, let's keep it simple: if topicIds or numQuestions are provided in PUT, we RE-POOL
        if ((topicIds !== undefined || numQuestions !== undefined) && exam.mode === 'CBT') {
            const finalTopicIds = topicIds || exam.topicIds || [];
            const finalNumQuestions = numQuestions !== undefined ? Number(numQuestions) : (exam.numQuestions || 0);

            if (finalTopicIds.length > 0 && finalNumQuestions > 0) {
                const pool = await prisma.cbtQuestion.findMany({
                    where: {
                        courseId: exam.courseId,
                        topicId: { in: finalTopicIds },
                        isActive: true
                    },
                    select: { id: true }
                });

                const shuffled = pool.sort(() => 0.5 - Math.random());
                const finalQuestionIds = shuffled.slice(0, finalNumQuestions).map(q => q.id);

                await prisma.cbtExamQuestion.deleteMany({ where: { examId: exam.id } });
                await prisma.cbtExamQuestion.createMany({
                    data: finalQuestionIds.map((qId, idx) => ({ examId: exam.id, questionId: qId, order: idx + 1 })),
                });
            }
        }

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
        const { password, type } = req.body; // type: 'archive' | 'full'
        if (!password) return res.status(400).json({ error: 'Password required' });

        // Verify Admin Password
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(403).json({ error: 'Invalid password' });

        const settings = readSettings();
        const graceDays = settings.examDeletionGraceDays || 3;

        if (type === 'archive') {
            await prisma.cbtExam.update({
                where: { id: req.params.id },
                data: { isArchived: true }
            });
            return res.json({ message: 'Exam removed from schedule' });
        } else {
            // Schedule for deletion
            const scheduledAt = new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
            await prisma.cbtExam.update({
                where: { id: req.params.id },
                data: {
                    isArchived: true,
                    deletionScheduledAt: scheduledAt
                }
            });
            return res.json({ message: `Exam scheduled for permanent deletion in ${graceDays} days` });
        }
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

        // ATTENDANCE GUARD: Check for active attendance session
        const activeSession = await prisma.attendanceSession.findFirst({
            where: {
                courseId: exam.courseId,
                semesterId: exam.semesterId,
                isActive: true,
                AND: [
                    { OR: [{ departmentId: req.user.student.departmentId }, { departmentId: null }] },
                    { OR: [{ level: req.user.student.level }, { level: null }] }
                ]
            }
        });

        if (!activeSession) {
            return res.status(403).json({ error: 'Attendance session not started. Please wait for the instructor or admin to start the session.' });
        }

        // Check time window
        const now = new Date();
        if (exam.startWindow && now < exam.startWindow) return res.status(403).json({ error: 'Exam has not started yet' });
        if (exam.endWindow && now > exam.endWindow) return res.status(403).json({ error: 'Exam window has closed' });

        // Check for existing attempt
        const existing = await prisma.cbtAttempt.findUnique({
            where: { examId_studentId: { examId: exam.id, studentId } },
            include: { answers: true }
        });
        if (existing?.isCompleted) return res.status(409).json({ error: 'You have already completed this exam' });

        if (existing) {
            return res.json({
                attempt: existing,
                questions: exam.questions.map(q => q.question),
                exam: { title: exam.title, instructions: exam.instructions, durationMinutes: exam.durationMinutes, totalMarks: exam.totalMarks },
                savedAnswers: existing.answers
            });
        }

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

// POST /api/cbt/attempts/:id/save-answer — save single answer, permanent check
router.post('/attempts/:id/save-answer', requireRole('STUDENT'), async (req, res, next) => {
    try {
        const { questionId, selected } = req.body;
        const studentId = req.user.student?.id;

        const attempt = await prisma.cbtAttempt.findUnique({
            where: { id: req.params.id },
            include: {
                exam: { include: { questions: { where: { questionId }, include: { question: true } } } },
                answers: { where: { questionId } }
            }
        });

        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
        if (attempt.studentId !== studentId) return res.status(403).json({ error: 'Unauthorized attempt' });
        if (attempt.isCompleted) return res.status(403).json({ error: 'Exam already submitted' });

        // Permanent Answer Logic: If an answer exists, it cannot be changed
        if (attempt.answers.length > 0 && attempt.answers[0].selected !== null) {
            return res.status(403).json({ error: 'Answer already submitted and cannot be changed' });
        }

        const question = attempt.exam.questions[0]?.question;
        if (!question) return res.status(404).json({ error: 'Question not found in this exam' });

        const isCorrect = selected === question.correctOption;

        const answer = await prisma.cbtAnswer.upsert({
            where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
            create: { attemptId: attempt.id, questionId, selected, isCorrect },
            update: { selected, isCorrect }
        });

        res.json({ success: true, answer });
    } catch (err) { next(err); }
});

// POST /api/cbt/attempts/:id/submit — submit answers and auto-grade
router.post('/attempts/:id/submit', requireRole('STUDENT'), async (req, res, next) => {
    try {
        const studentId = req.user.student?.id;

        const attempt = await prisma.cbtAttempt.findUnique({
            where: { id: req.params.id },
            include: {
                exam: { include: { questions: { include: { question: { select: { id: true, correctOption: true, marks: true } } } } } },
                answers: true
            },
        });
        if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
        if (attempt.studentId !== studentId) return res.status(403).json({ error: 'Forbidden' });
        if (attempt.isCompleted) return res.status(409).json({ error: 'Already submitted' });

        // Grade finalized answers from DB
        let totalScore = 0;
        const questionMap = Object.fromEntries(attempt.exam.questions.map(q => [q.question.id, q.question]));

        for (const ans of attempt.answers) {
            const question = questionMap[ans.questionId];
            if (question && ans.selected === question.correctOption) {
                totalScore += question.marks;
            }
        }

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
