import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/faculties — List all faculties
router.get('/', authenticate, async (req, res, next) => {
    try {
        const faculties = await prisma.faculty.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { departments: true } } }
        });
        res.json(faculties);
    } catch (err) { next(err); }
});

// POST /api/faculties — Create a faculty (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { name, description } = req.body;
        const faculty = await prisma.faculty.create({
            data: { name, description }
        });
        res.status(201).json(faculty);
    } catch (err) { next(err); }
});

// PUT /api/faculties/:id — Update a faculty (Admin only)
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const faculty = await prisma.faculty.update({
            where: { id },
            data: { name, description }
        });
        res.json(faculty);
    } catch (err) { next(err); }
});

// DELETE /api/faculties/:id — Delete a faculty (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.faculty.delete({ where: { id } });
        res.json({ message: 'Faculty deleted successfully' });
    } catch (err) { next(err); }
});

export default router;
