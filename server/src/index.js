import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import instructorRoutes from './routes/instructors.js';
import courseRoutes from './routes/courses.js';
import attendanceRoutes from './routes/attendance.js';
import examRoutes from './routes/exams.js';
import cbtRoutes from './routes/cbt.js';
import syncRoutes from './routes/sync.js';
import sessionRoutes from './routes/sessions.js';
import settingsRoutes from './routes/settings.js';
import profileRoutes from './routes/profile.js';
import facultyRoutes from './routes/faculties.js';
import departmentRoutes from './routes/departments.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any LAN IP (no strict origin check for local network)
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), app: 'Classify API' });
});

// ─── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/cbt', cbtRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/faculties', facultyRoutes);
app.use('/api/departments', departmentRoutes);

// ─── 404 Handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Classify API running on port ${PORT}`);
  console.log(`   Local:   http://localhost:${PORT}/api/health`);
  console.log(`   Network: http://0.0.0.0:${PORT}/api/health\n`);
});

export default app;
