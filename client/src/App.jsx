import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './layouts/AppLayout';
import './index.css';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import StudentsPage from './pages/StudentsPage';
import StudentProfile from './pages/StudentProfile';
import InstructorsPage from './pages/InstructorsPage';
import CoursesPage from './pages/CoursesPage';
import CourseDetail from './pages/CourseDetail';
import AttendancePage from './pages/AttendancePage';
import ExamsPage from './pages/ExamsPage';
import CbtAdminPage from './pages/CbtAdminPage';
import CbtExamPage from './pages/CbtExamPage';
import CbtResults from './pages/CbtResults';
import CloudSyncPage from './pages/CloudSyncPage';
import ServerControlPage from './pages/ServerControlPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import AcademicStructurePage from './pages/AcademicStructurePage';
import SessionManagementPage from './pages/SessionManagementPage';

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute roles={['ADMIN', 'INSTRUCTOR']}><StudentsPage /></ProtectedRoute>} />
      <Route path="/students/:id" element={<ProtectedRoute roles={['ADMIN', 'INSTRUCTOR']}><StudentProfile /></ProtectedRoute>} />
      <Route path="/instructors" element={<ProtectedRoute roles={['ADMIN']}><InstructorsPage /></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
      <Route path="/courses/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute roles={['ADMIN', 'INSTRUCTOR']}><AttendancePage /></ProtectedRoute>} />
      <Route path="/exams" element={<ProtectedRoute roles={['ADMIN', 'INSTRUCTOR']}><ExamsPage /></ProtectedRoute>} />
      <Route path="/cbt/admin" element={<ProtectedRoute roles={['ADMIN', 'INSTRUCTOR']}><CbtAdminPage /></ProtectedRoute>} />
      <Route path="/cbt/exam" element={<ProtectedRoute roles={['STUDENT']}><CbtExamPage /></ProtectedRoute>} />
      <Route path="/cbt/results/:id" element={<ProtectedRoute><CbtResults /></ProtectedRoute>} />
      <Route path="/sync" element={<ProtectedRoute roles={['ADMIN']}><CloudSyncPage /></ProtectedRoute>} />
      <Route path="/server-control" element={<ProtectedRoute roles={['ADMIN']}><ServerControlPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute roles={['ADMIN']}><SettingsPage /></ProtectedRoute>} />
      <Route path="/academic-structure" element={<ProtectedRoute roles={['ADMIN']}><AcademicStructurePage /></ProtectedRoute>} />
      <Route path="/academic-sessions" element={<ProtectedRoute roles={['ADMIN']}><SessionManagementPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
