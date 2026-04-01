import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/profile — Get full profile for current user
router.get('/', authenticate, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                student: true,
                instructor: true,
                admin: true,
            },
        });
        const { password, ...safeUser } = user;
        res.json(safeUser);
    } catch (err) { next(err); }
});

// PUT /api/profile — Update profile
router.put('/', authenticate, async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        const data = req.body;

        if (data.email) {
            const emailClean = data.email.toLowerCase().trim();
            const existing = await prisma.user.findUnique({ where: { email: emailClean } });
            if (existing && existing.id !== userId) return res.status(400).json({ error: 'Email already in use by another account' });
            await prisma.user.update({ where: { id: userId }, data: { email: emailClean } });
        }

        if (role === 'STUDENT') {
            const { firstName, lastName, phone, address, gender, avatarUrl, departmentId, facultyId, level, matricNumber } = data;
            
            let updateMatricNumber;
            if (matricNumber) {
                const currentStudent = await prisma.student.findUnique({ where: { userId } });
                if (currentStudent && currentStudent.matricNumber.startsWith('PENDING-')) {
                    const newMatric = matricNumber.toUpperCase().trim();
                    if (!newMatric.startsWith('PENDING-')) {
                        updateMatricNumber = newMatric;
                    }
                } else if (currentStudent && currentStudent.matricNumber !== matricNumber.toUpperCase().trim()) {
                    return res.status(403).json({ error: 'You cannot change an already assigned matric number' });
                }
            }

            try {
                const updated = await prisma.student.update({
                    where: { userId },
                    data: {
                        firstName,
                        lastName,
                        phone,
                        address,
                        gender,
                        avatarUrl,
                        departmentId,
                        facultyId,
                        ...(level ? { level: Number(level) } : {}),
                        ...(updateMatricNumber ? { matricNumber: updateMatricNumber } : {})
                    },
                });
                return res.json({ message: 'Profile updated', profile: updated });
            } catch (err) {
                if (err.code === 'P2002') return res.status(409).json({ error: 'Matric number is already registered to another student' });
                throw err;
            }
        }

        if (role === 'INSTRUCTOR') {
            const { firstName, lastName, phone, departmentId, facultyId, avatarUrl, qualification } = data;
            const updated = await prisma.instructor.update({
                where: { userId },
                data: {
                    firstName,
                    lastName,
                    phone,
                    departmentId,
                    facultyId,
                    avatarUrl,
                    qualification,
                },
            });
            return res.json({ message: 'Profile updated', profile: updated });
        }

        if (role === 'ADMIN') {
            const { fullName, phone, avatarUrl } = data;
            const updated = await prisma.admin.update({
                where: { userId },
                data: {
                    fullName,
                    phone,
                    avatarUrl,
                },
            });
            return res.json({ message: 'Profile updated', profile: updated });
        }

        res.status(400).json({ error: 'Invalid role for profile update' });
    } catch (err) { next(err); }
});

export default router;
