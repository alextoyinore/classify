import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { isStudentInExamPeriod } from '../lib/examRestrictions.js';

const router = Router();
router.use(authenticate);

// ─── GET /api/messages/users ─────────────────────────────────────────────────
// Fetch list of users the current user has chatted with OR can message.
// For now, Admins can message anyone, Students can message Admins and other Students.
router.get('/users', async (req, res, next) => {
    try {
        const currentUserId = req.user.id;
        const role = req.user.role;

        // Find users based on role
        let users = [];

        if (role === 'ADMIN' || role === 'INSTRUCTOR') {
            // Can message anyone. Let's return students and admins/instructors
            users = await prisma.user.findMany({
                where: { id: { not: currentUserId } },
                select: {
                    id: true, role: true,
                    student: { select: { firstName: true, lastName: true, matricNumber: true } },
                    admin: { select: { fullName: true } },
                    instructor: { select: { firstName: true, lastName: true } }
                }
            });
        } else if (role === 'STUDENT') {
            // Can message Admins, Instructors, and other Students
            users = await prisma.user.findMany({
                where: { id: { not: currentUserId } },
                select: {
                    id: true, role: true,
                    student: { select: { firstName: true, lastName: true, matricNumber: true } },
                    admin: { select: { fullName: true } },
                    instructor: { select: { firstName: true, lastName: true } }
                }
            });
        }

        // Add last message info
        const usersWithLastMessage = await Promise.all(users.map(async u => {
            const lastMessage = await prisma.message.findFirst({
                where: {
                    OR: [
                        { senderId: currentUserId, receiverId: u.id },
                        { senderId: u.id, receiverId: currentUserId }
                    ]
                },
                orderBy: { createdAt: 'desc' },
                select: { content: true, createdAt: true, isRead: true, senderId: true }
            });

            // Count unread messages from this user to me
            const unreadCount = await prisma.message.count({
                where: {
                    senderId: u.id,
                    receiverId: currentUserId,
                    isRead: false
                }
            });

            return { ...u, lastMessage, unreadCount };
        }));

        // Sort by last message date, putting active chats at the top
        usersWithLastMessage.sort((a, b) => {
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
        });

        res.json({ data: usersWithLastMessage });
    } catch (err) { next(err); }
});

// ─── GET /api/messages/:userId ────────────────────────────────────────────────
// Get conversation with a specific user and mark messages as read
router.get('/:userId', async (req, res, next) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        // Mark messages as read
        await prisma.message.updateMany({
            where: {
                senderId: userId,
                receiverId: currentUserId,
                isRead: false
            },
            data: { isRead: true }
        });

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: currentUserId, receiverId: userId },
                    { senderId: userId, receiverId: currentUserId }
                ]
            },
            orderBy: { createdAt: 'asc' },
            take: 100 // Limit history for performance, could add pagination later
        });

        res.json({ data: messages });
    } catch (err) { next(err); }
});

// ─── POST /api/messages ───────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
    try {
        const { receiverId, content } = req.body;
        const currentUserId = req.user.id;
        const role = req.user.role;

        if (!receiverId || !content) {
            return res.status(400).json({ error: 'Receiver and content are required' });
        }

        // Check if receiver exists
        const receiver = await prisma.user.findUnique({
            where: { id: receiverId },
            select: { role: true }
        });

        if (!receiver) {
            return res.status(404).json({ error: 'Receiver not found' });
        }

        // Apply Exam Period Restrictions for STUDENT -> STUDENT ONLY
        // An Admin can message a Student, and a Student can message an Admin even during exams.
        if (role === 'STUDENT' && receiver.role === 'STUDENT') {
            // Need the sender's studentId
            const studentNode = await prisma.student.findUnique({
                where: { userId: currentUserId },
                select: { id: true }
            });

            if (studentNode) {
                const inExam = await isStudentInExamPeriod(studentNode.id);
                if (inExam) {
                    return res.status(403).json({ error: 'Messaging other students is disabled while you are in an active exam period.' });
                }
            }

            // Also check if the RECEIVER is in an exam, block sending if they are.
            const receiverNode = await prisma.student.findUnique({
                where: { userId: receiverId },
                select: { id: true }
            });

            if (receiverNode) {
                const receiverInExam = await isStudentInExamPeriod(receiverNode.id);
                if (receiverInExam) {
                    return res.status(403).json({ error: 'This student is currently taking an exam and cannot receive messages.' });
                }
            }
        }

        const message = await prisma.message.create({
            data: {
                senderId: currentUserId,
                receiverId,
                content
            }
        });

        res.status(201).json({ message });
    } catch (err) { next(err); }
});

// ─── GET /api/messages/unread/count ───────────────────────────────────────────
router.get('/unread/count', async (req, res, next) => {
    try {
        const count = await prisma.message.count({
            where: {
                receiverId: req.user.id,
                isRead: false
            }
        });
        res.json({ count });
    } catch (err) { next(err); }
});

export default router;
