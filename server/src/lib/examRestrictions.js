import { prisma } from './prisma.js';

/**
 * Checks if a student is CURRENTLY strictly within a CBT exam or Written exam window.
 * Used for blocking student-to-student messaging.
 */
export async function isStudentInExamPeriod(studentId) {
    const now = new Date();

    // Find courses the student is enrolled in for the current session/semester
    const enrollments = await prisma.enrollment.findMany({
        where: { studentId },
        select: { courseId: true }
    });

    if (enrollments.length === 0) return false;
    const courseIds = enrollments.map(e => e.courseId);

    // Check CBT Exams (Strictly between startWindow and endWindow)
    const activeCbt = await prisma.cbtExam.findFirst({
        where: {
            courseId: { in: courseIds },
            isPublished: true,
            startWindow: { lte: now },
            endWindow: { gte: now }
        }
    });

    if (activeCbt) return true;

    // Check Written Exams (Assuming 2 hours duration)
    // Exam is active if now is between examDate and (examDate + 2 hours)
    const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

    const activeWritten = await prisma.exam.findFirst({
        where: {
            courseId: { in: courseIds },
            examDate: {
                lte: now,
                gte: twoHoursAgo
            }
        }
    });

    if (activeWritten) return true;

    return false;
}

/**
 * Checks if a student is within the resource restriction window.
 * This includes the exam duration PLUS a 5-minute buffer before and after.
 */
export async function isStudentInResourceRestrictionPeriod(studentId) {
    const now = new Date();

    // Find courses the student is enrolled in
    const enrollments = await prisma.enrollment.findMany({
        where: { studentId },
        select: { courseId: true }
    });

    if (enrollments.length === 0) return false;
    const courseIds = enrollments.map(e => e.courseId);

    // Build the check timestamp bounds
    const fiveMinsAfterNow = new Date(now.getTime() + (5 * 60 * 1000));
    const fiveMinsBeforeNow = new Date(now.getTime() - (5 * 60 * 1000));

    // For CBT: Block if (now + 5m) >= startWindow AND (now - 5m) <= endWindow
    // Meaning the window extended by 5 mins on both sides covers `now`.
    const restrictedCbt = await prisma.cbtExam.findFirst({
        where: {
            courseId: { in: courseIds },
            isPublished: true,
            startWindow: { lte: fiveMinsAfterNow },
            endWindow: { gte: fiveMinsBeforeNow }
        }
    });

    if (restrictedCbt) return true;

    // For Written Exam: Block if roughly within [-5m, 2h + 5m] of examDate
    // which means examDate is between (now - 2h - 5m) and (now + 5m)
    const twoHoursFiveMinsAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000) - (5 * 60 * 1000));

    const restrictedWritten = await prisma.exam.findFirst({
        where: {
            courseId: { in: courseIds },
            examDate: {
                lte: fiveMinsAfterNow,
                gte: twoHoursFiveMinsAgo
            }
        }
    });

    if (restrictedWritten) return true;

    return false;
}
