import { Router } from 'express';
import { join, basename } from 'path';
import fs from 'fs';
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

// ─── GET /api/sync/local ───────────────────────────────────
router.get('/local', async (req, res) => {
    try {
        const dir = 'uploads/backups';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const stats = fs.statSync(join(dir, f));
                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            })
            .sort((a, b) => b.createdAt - a.createdAt);

        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/sync/local/download/:filename ────────────────
router.get('/local/download/:filename', (req, res) => {
    const filePath = join(process.cwd(), 'uploads/backups', basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    res.download(filePath);
});

// ─── DELETE /api/sync/local/:filename ──────────────────────
router.delete('/local/:filename', (req, res) => {
    const filePath = join(process.cwd(), 'uploads/backups', basename(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });
    fs.unlinkSync(filePath);
    res.json({ message: 'Backup deleted' });
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
        let localStatus = 'PENDING';
        let cloudStatus = 'PENDING';
        let errorMsg = null;

        try {
            // 1. Fetch ALL Data for a complete backup
            const [
                users, admins, instructors, students,
                faculties, departments,
                sessions, semesters,
                courses, topics, courseInstructors, enrollments,
                exams, scores,
                cbtExams, questions, examQuestions, attempts, answers,
                resources, attendance
            ] = await Promise.all([
                prisma.user.findMany({ select: { id: true, email: true, role: true, isActive: true, createdAt: true } }),
                prisma.admin.findMany(),
                prisma.instructor.findMany(),
                prisma.student.findMany(),
                prisma.faculty.findMany(),
                prisma.department.findMany(),
                prisma.academicSession.findMany(),
                prisma.semester_.findMany(),
                prisma.course.findMany(),
                prisma.courseTopic.findMany(),
                prisma.courseInstructor.findMany(),
                prisma.enrollment.findMany(),
                prisma.exam.findMany(),
                prisma.score.findMany(),
                prisma.cbtExam.findMany(),
                prisma.cbtQuestion.findMany(),
                prisma.cbtExamQuestion.findMany(),
                prisma.cbtAttempt.findMany(),
                prisma.cbtAnswer.findMany(),
                prisma.resource.findMany(),
                prisma.attendance.findMany({ take: 10000 })
            ]);

            // 2. Perform Local Backup
            try {
                const backupDir = 'uploads/backups';
                if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

                const backupFilename = `db-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                const backupPath = join(backupDir, backupFilename);
                const backupData = {
                    version: '1.2',
                    timestamp: new Date(),
                    data: {
                        users, admins, instructors, students,
                        faculties, departments,
                        sessions, semesters,
                        courses, topics, courseInstructors, enrollments,
                        exams, scores,
                        cbtExams, questions, examQuestions, attempts, answers,
                        resources, attendance
                    }
                };
                fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
                localStatus = 'SUCCESS';
            } catch (localErr) {
                console.error('[sync] Local backup failed:', localErr.message);
                localStatus = 'FAILED';
                errorMsg = `Local: ${localErr.message}`;
            }

            // 3. Perform Cloud Sync (Selective sync to stay within Supabase limits/schema)
            if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
                try {
                    const { createClient } = await import('@supabase/supabase-js');
                    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

                    // Students
                    if (students.length) {
                        await supabase.from('students').upsert(students.map(s => ({
                            id: s.id, matric_number: s.matricNumber, first_name: s.firstName, last_name: s.lastName,
                            department: s.department, level: s.level, is_active: s.isActive
                        })));
                    }

                    // Attendance
                    if (attendance.length) {
                        await supabase.from('attendance').upsert(attendance.map(a => ({
                            id: a.id, student_id: a.studentId, course_id: a.courseId, date: a.date, status: a.status
                        })));
                    }

                    // Scores
                    if (scores.length) {
                        await supabase.from('scores').upsert(scores.map(s => ({
                            id: s.id, student_id: s.studentId, exam_id: s.examId, score: s.score, grade: s.grade
                        })));
                    }

                    // CBT Attempts
                    if (attempts.length) {
                        await supabase.from('cbt_attempts').upsert(attempts.map(a => ({
                            id: a.id, student_id: a.studentId, exam_id: a.examId, score: a.score,
                            percentage: a.percentage, is_passed: a.isPassed, started_at: a.startedAt, submitted_at: a.submittedAt
                        })));
                    }
                    cloudStatus = 'SUCCESS';
                } catch (cloudErr) {
                    console.error('[sync] Cloud sync failed:', cloudErr.message);
                    cloudStatus = 'FAILED';
                    errorMsg = errorMsg ? `${errorMsg} | Cloud: ${cloudErr.message}` : `Cloud: ${cloudErr.message}`;
                }
            } else {
                cloudStatus = 'SKIPPED';
            }

            // Calculate overall status
            let overallStatus = 'SUCCESS';
            if (localStatus === 'FAILED' && (cloudStatus === 'FAILED' || cloudStatus === 'SKIPPED')) {
                overallStatus = 'FAILED';
            } else if (localStatus === 'FAILED' || cloudStatus === 'FAILED') {
                overallStatus = 'PARTIAL';
            }

            // Calculate record count based on all models
            recordCount = [
                users, admins, instructors, students, faculties, departments,
                sessions, semesters, courses, topics, courseInstructors, enrollments,
                exams, scores, cbtExams, questions, examQuestions, attempts, answers, resources, attendance
            ].reduce((acc, curr) => acc + curr.length, 0);

            await prisma.syncLog.update({
                where: { id: log.id },
                data: {
                    status: overallStatus,
                    localStatus: localStatus,
                    cloudStatus: cloudStatus,
                    recordCount,
                    errorMsg: errorMsg,
                    completedAt: new Date()
                },
            });
            console.log(`[sync] Full Hybrid Backup complete — ${overallStatus} (Local: ${localStatus}, Cloud: ${cloudStatus})`);
        } catch (err) {
            console.error('[sync] Backup process crashed:', err.message);
            await prisma.syncLog.update({
                where: { id: log.id },
                data: {
                    status: 'FAILED',
                    localStatus: localStatus === 'PENDING' ? 'FAILED' : localStatus,
                    cloudStatus: cloudStatus === 'PENDING' ? 'FAILED' : cloudStatus,
                    errorMsg: err.message,
                    completedAt: new Date()
                },
            });
        }
    })();
});

export default router;
