import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/departments — List all departments
router.get('/', async (req, res, next) => {
    try {
        const { facultyId } = req.query;
        const where = facultyId ? { facultyId } : {};
        const departments = await prisma.department.findMany({
            where,
            orderBy: { name: 'asc' },
            include: { faculty: true }
        });
        res.json(departments);
    } catch (err) { next(err); }
});

// POST /api/departments — Create a department (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { name, facultyId } = req.body;
        const department = await prisma.department.create({
            data: { name, facultyId }
        });
        res.status(201).json(department);
    } catch (err) { next(err); }
});

// PUT /api/departments/:id — Update a department (Admin only)
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, facultyId } = req.body;
        const department = await prisma.department.update({
            where: { id },
            data: { name, facultyId }
        });
        res.json(department);
    } catch (err) { next(err); }
});

// DELETE /api/departments/:id — Delete a department (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.department.delete({ where: { id } });
        res.json({ message: 'Department deleted successfully' });
    } catch (err) { next(err); }
});

export default router;
