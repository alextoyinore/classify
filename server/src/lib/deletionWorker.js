import { prisma } from './prisma.js';

export const startDeletionWorker = () => {
    console.log('--- Deletion Worker Started ---');

    // Run every hour
    setInterval(async () => {
        try {
            const now = new Date();
            console.log(`[DeletionWorker] Checking for expired deletions at ${now.toISOString()}`);

            // Auto-deletion disabled by request. 
            // Admins must now manually confirm from the Dashboard Banner.

            /*
            // 1. Delete Written Exams
            const writtenToDelete = await prisma.exam.findMany({
                where: { deletionScheduledAt: { lte: now } }
            });

            for (const exam of writtenToDelete) {
                console.log(`[DeletionWorker] Hard deleting written exam: ${exam.title} (${exam.id})`);
                // Use a transaction to ensure all scores are deleted first if not cascading
                await prisma.$transaction([
                    prisma.score.deleteMany({ where: { examId: exam.id } }),
                    prisma.exam.delete({ where: { id: exam.id } })
                ]);
            }

            // 2. Delete CBT Exams
            const cbtToDelete = await prisma.cbtExam.findMany({
                where: { deletionScheduledAt: { lte: now } }
            });

            for (const exam of cbtToDelete) {
                console.log(`[DeletionWorker] Hard deleting CBT exam: ${exam.title} (${exam.id})`);
                await prisma.$transaction([
                    prisma.cbtAnswer.deleteMany({ where: { attempt: { examId: exam.id } } }),
                    prisma.cbtAttempt.deleteMany({ where: { examId: exam.id } }),
                    prisma.cbtExamQuestion.deleteMany({ where: { examId: exam.id } }),
                    prisma.cbtExam.delete({ where: { id: exam.id } })
                ]);
            }
            */

        } catch (err) {
            console.error('[DeletionWorker] Error:', err);
        }
    }, 60 * 60 * 1000); // 1 hour
};
