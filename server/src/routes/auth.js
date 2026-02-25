import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body; // 'email' field in request can be email or matric
        if (!email || !password)
            return res.status(400).json({ error: 'Identifier and password are required' });

        const identifier = email.toLowerCase().trim();

        // Search by Email OR Students via Matric Number
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { student: { matricNumber: { equals: identifier.toUpperCase(), mode: 'insensitive' } } }
                ]
            },
            include: {
                student: { select: { id: true, firstName: true, lastName: true, matricNumber: true, level: true, departmentId: true, department: true, facultyId: true, faculty: true, avatarUrl: true } },
                instructor: { select: { id: true, firstName: true, lastName: true, staffId: true, departmentId: true, department: true, facultyId: true, faculty: true, avatarUrl: true } },
                admin: { select: { id: true, fullName: true, avatarUrl: true } },
            },
        });

        if (!user) return res.status(401).json({ error: 'Invalid identifier or password' });
        if (!user.isActive) return res.status(403).json({ error: 'Account is deactivated' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid identifier or password' });

        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        const profile = user.student || user.instructor || user.admin;
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                profile,
            },
        });
    } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    const { password, ...safeUser } = req.user;
    res.json({ user: safeUser });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
            return res.status(400).json({ error: 'Both passwords are required' });
        if (newPassword.length < 8)
            return res.status(400).json({ error: 'New password must be at least 8 characters' });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

        const hashed = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });

        res.json({ message: 'Password changed successfully' });
    } catch (err) { next(err); }
});

// POST /api/auth/register (Student Self-Registration)
router.post('/register', async (req, res, next) => {
    try {
        const { password, fullName, matricNumber, departmentId } = req.body;
        if (!password || !fullName || !matricNumber)
            return res.status(400).json({ error: 'All fields are required' });

        if (password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters' });

        const mNumber = matricNumber.toUpperCase().trim();

        // Split fullName into firstName and lastName
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Student';

        const hashed = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: {
                // Use matric number as temporary email unique key
                email: `${mNumber.replace(/\//g, '_')}@university.local`,
                password: hashed,
                role: 'STUDENT',
                student: {
                    create: {
                        firstName,
                        lastName,
                        matricNumber: mNumber,
                        departmentId,
                        gender: 'OTHER',
                        level: 100,
                        entryYear: String(new Date().getFullYear()),
                    },
                },
            },
        });

        res.status(201).json({ message: 'Registration successful. Please sign in.' });
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Email or matric number already exists' });
        next(err);
    }
});

export default router;
