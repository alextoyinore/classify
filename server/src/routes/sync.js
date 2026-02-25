import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

// ─── GET /api/sync/status ───────────────────────────────────
router.get('/status', async (req, res) => {
    try {
        const last = await prisma.syncLog.findFirst({
            where: { status: 'SUCCESS' },
            orderBy: { completedAt: 'desc' },
        });
        const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
        res.json({
            connected: hasSupabase,
            lastSync: last?.completedAt ?? null,
            lastCount: last?.recordCount ?? null,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/sync/logs ────────────────────────────────────
router.get('/logs', async (req, res) => {
    try {
        const logs = await prisma.syncLog.findMany({
            orderBy: { startedAt: 'desc' },
            take: 50,
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/sync/backup ─────────────────────────────────
router.post('/backup', async (req, res) => {
    // Create a pending log entry
    const log = await prisma.syncLog.create({
        data: { triggeredBy: req.user.id, status: 'PENDING' },
    });

    // Run sync async so we can respond quickly
    res.json({ message: 'Backup started', logId: log.id });

    (async () => {
        let recordCount = 0;
        try {
            if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
                throw new Error('Supabase credentials not configured in server/.env');
            }

            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_KEY
            );

            // Sync Students
            const students = await prisma.student.findMany({
                include: { user: { select: { email: true } } },
            });
            if (students.length) {
                const { error } = await supabase.from('students').upsert(
                    students.map(s => ({
                        id: s.id, matric_number: s.matricNumber,
                        first_name: s.firstName, last_name: s.lastName,
                        department: s.department, level: s.level,
                        email: s.user?.email, is_active: s.isActive,
                    }))
                );
                if (error) throw new Error(error.message);
                recordCount += students.length;
            }

            // Sync Attendance
            const attendance = await prisma.attendance.findMany({ take: 5000 });
            if (attendance.length) {
                const { error } = await supabase.from('attendance').upsert(
                    attendance.map(a => ({
                        id: a.id, student_id: a.studentId, course_id: a.courseId,
                        date: a.date, status: a.status,
                    }))
                );
                if (error) throw new Error(error.message);
                recordCount += attendance.length;
            }

            // Sync Scores
            const scores = await prisma.score.findMany({ include: { exam: true } });
            if (scores.length) {
                const { error } = await supabase.from('scores').upsert(
                    scores.map(s => ({
                        id: s.id, student_id: s.studentId, exam_id: s.examId,
                        score: s.score, grade: s.grade,
                    }))
                );
                if (error) throw new Error(error.message);
                recordCount += scores.length;
            }

            // Sync CBT Attempts
            const attempts = await prisma.cbtAttempt.findMany();
            if (attempts.length) {
                const { error } = await supabase.from('cbt_attempts').upsert(
                    attempts.map(a => ({
                        id: a.id, student_id: a.studentId, exam_id: a.examId,
                        score: a.score, percentage: a.percentage, is_passed: a.isPassed,
                        started_at: a.startedAt, submitted_at: a.submittedAt,
                    }))
                );
                if (error) throw new Error(error.message);
                recordCount += attempts.length;
            }

            await prisma.syncLog.update({
                where: { id: log.id },
                data: { status: 'SUCCESS', recordCount, completedAt: new Date() },
            });
            console.log(`[sync] Backup complete — ${recordCount} records`);
        } catch (err) {
            console.error('[sync] Backup failed:', err.message);
            await prisma.syncLog.update({
                where: { id: log.id },
                data: { status: 'FAILED', errorMsg: err.message, completedAt: new Date() },
            });
        }
    })();
});

export default router;
