import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
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
import materialsRoutes from './routes/materials.js';
import messagesRoutes from './routes/messages.js';
import timetableRoutes from './routes/timetable.js';
import { startDeletionWorker } from './lib/deletionWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["'self'", "*"], // Allow embedding from the same app/host
      "img-src": ["'self'", "data:", "blob:", "*"],
      "media-src": ["'self'", "data:", "blob:", "*"],
      "script-src": ["'self'", "'sha256-XA3xPNZkdcgKoOBN/IQGq9SMAyznI1ACq2XzQVMZPic='"],
      "connect-src": ["'self'", "http:", "https:", "ws:", "wss:", "*"],
      "upgrade-insecure-requests": null,
    },
  },
  frameguard: false, // Disable X-Frame-Options to favor CSP frame-ancestors
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any LAN IP (no strict origin check for local network)
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
const uploadsPath = path.basename(__dirname) === 'src' 
  ? path.join(__dirname, '..', 'uploads') 
  : path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// ─── Static Files (Production) ──────────────────────────────
// In the bundled/production version, the client is moved to a 'public' folder next to the script
const clientDistPath = path.join(__dirname, 'public');
app.use(express.static(clientDistPath));

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
app.use('/api/materials', materialsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/timetable', timetableRoutes);

// ─── Catch-all for React Router (SPA) ──────────────────────
app.get('*', (req, res, next) => {
  // If the request is for an API route, let it fall through to 404 handler
  if (req.path.startsWith('/api/')) {
    return next();
  }
  // Don't serve the SPA for file paths — let them 404 naturally
  if (req.path.startsWith('/uploads/')) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      // If index.html is missing (e.g. not built yet), return 404
      next();
    }
  });
});

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

  // Start background workers
  startDeletionWorker();
});

export default app;

// Restarting for Prisma Client update (generated)
