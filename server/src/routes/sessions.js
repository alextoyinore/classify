import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/sessions/current — returns the current active semester
router.get('/current', async (req, res, next) => {
    try {
        const semester = await prisma.semester_.findFirst({
            where: { isCurrent: true },
            include: { session: { select: { title: true, isCurrent: true } } }
        });
        res.json(semester);
    } catch (err) { next(err); }
});

// GET /api/sessions — returns flat list of semesters (for dropdowns)
router.get('/', async (req, res, next) => {
    try {
        const sessions = await prisma.academicSession.findMany({
            include: { semesters: { orderBy: { name: 'asc' } } },
            orderBy: { createdAt: 'desc' },
        });
        // Flatten into semesters array with parent session info attached
        const semesters = sessions.flatMap(sess =>
            sess.semesters.map(sem => ({ ...sem, session: { id: sess.id, title: sess.title, isCurrent: sess.isCurrent } }))
        );
        res.json(semesters);
    } catch (err) { next(err); }
});

// GET /api/sessions/raw — full tree (admin use)
router.get('/raw', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const sessions = await prisma.academicSession.findMany({
            include: { semesters: { orderBy: { name: 'asc' } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(sessions);
    } catch (err) { next(err); }
});

// POST /api/sessions
router.post('/', async (req, res, next) => {
    try {
        const { title, startDate, endDate, setAsCurrent } = req.body;
        if (!title) return res.status(400).json({ error: 'Session title is required' });

        if (setAsCurrent) {
            await prisma.academicSession.updateMany({ data: { isCurrent: false } });
        }

        const session = await prisma.academicSession.create({
            data: {
                title,
                isCurrent: Boolean(setAsCurrent),
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                semesters: {
                    create: [
                        { name: 'FIRST', isCurrent: Boolean(setAsCurrent) },
                        { name: 'SECOND', isCurrent: false },
                    ],
                },
            },
            include: { semesters: true },
        });
        res.status(201).json(session); // return object directly, not wrapped in {session}
    } catch (err) { next(err); }
});

// DELETE /api/sessions/:id
router.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
    try {
        await prisma.academicSession.delete({ where: { id: req.params.id } });
        res.json({ message: 'Session deleted' });
    } catch (err) { next(err); }
});

// PUT /api/sessions/:id/set-current
router.put('/:id/set-current', async (req, res, next) => {
    try {
        await prisma.academicSession.updateMany({ data: { isCurrent: false } });
        const session = await prisma.academicSession.update({
            where: { id: req.params.id }, data: { isCurrent: true },
        });
        res.json({ session });
    } catch (err) { next(err); }
});

// PUT /api/sessions/semesters/:id/set-current
router.put('/semesters/:id/set-current', async (req, res, next) => {
    try {
        await prisma.semester_.updateMany({ data: { isCurrent: false } });
        const semester = await prisma.semester_.update({
            where: { id: req.params.id }, data: { isCurrent: true },
        });
        res.json({ semester });
    } catch (err) { next(err); }
});

export default router;
