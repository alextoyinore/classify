import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, UserCheck, BookOpen, ClipboardCheck,
    FileText, Monitor, Cloud, Settings, LogOut, GraduationCap,
    ChevronRight, User, Building2, Calendar, Menu, X, AlertTriangle, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { useToast } from '../context/ToastContext';

const nav = [
    {
        section: 'Overview', items: [
            { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/profile', label: 'My Profile', icon: User },
        ]
    },
    {
        section: 'People', items: [
            { to: '/students', label: 'Students', icon: Users, roles: ['ADMIN', 'INSTRUCTOR'] },
            { to: '/instructors', label: 'Instructors', icon: UserCheck, roles: ['ADMIN'] },
        ]
    },
    {
        section: 'Academic', items: [
            { to: '/courses', label: 'Courses', icon: BookOpen },
            { to: '/attendance', label: 'Attendance', icon: ClipboardCheck, roles: ['ADMIN', 'INSTRUCTOR'] },
            { to: '/exams', label: 'Examinations', icon: FileText, roles: ['ADMIN', 'INSTRUCTOR'] },
            { to: '/results', label: 'Aggregate Results', icon: GraduationCap, roles: ['ADMIN', 'INSTRUCTOR'] },
            { to: '/my-results', label: 'My Results', icon: GraduationCap, roles: ['STUDENT'] },
            { to: '/academic-sessions', label: 'Academic Sessions', icon: Calendar, roles: ['ADMIN'] },
            { to: '/academic-structure', label: 'Academic Structure', icon: Building2, roles: ['ADMIN'] },
        ]
    },
    {
        section: 'CBT', items: [
            { to: '/cbt/admin', label: 'Question Bank', icon: Monitor, roles: ['ADMIN', 'INSTRUCTOR'] },
            { to: '/cbt/exam', label: 'My Exams', icon: GraduationCap, roles: ['STUDENT'] },
        ]
    },
    {
        section: 'System', items: [
            { to: '/sync', label: 'Cloud Sync', icon: Cloud, roles: ['ADMIN'] },
            { to: '/settings', label: 'Settings', icon: Settings, roles: ['ADMIN'] },
        ]
    },
];

export default function AppLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [pendingDeletions, setPendingDeletions] = useState([]);

    const fetchPending = async () => {
        if (user?.role === 'STUDENT') return;
        try {
            const { data } = await api.get('/exams/pending/deletions');
            setPendingDeletions(data.data || []);
        } catch { }
    };

    useEffect(() => {
        fetchPending();
        const interval = setInterval(fetchPending, 10 * 60 * 1000); // 10 min
        return () => clearInterval(interval);
    }, [user]);

    const handleFinalDelete = async (exam) => {
        if (!confirm(`Permanently delete "${exam.title}" and ALL associated student records? This cannot be undone.`)) return;
        try {
            await api.post(`/exams/${exam.id}/final-delete`, { isCbt: exam.isCbt });
            toast('Exam permanently deleted');
            fetchPending();
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to delete', 'error');
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const displayName = user?.profile?.firstName || user?.profile?.fullName || user?.email || 'User';
    const initials = (user?.profile?.firstName || user?.profile?.fullName || user?.email || '?').substring(0, 2).toUpperCase();

    return (
        <div className="app-shell">
            {/* Pending Deletion Banner */}
            {pendingDeletions.length > 0 && user?.role === 'ADMIN' && (
                <div className="deletion-banner animate-fade-in">
                    <div className="banner-content">
                        <AlertTriangle size={18} />
                        <span>
                            <strong>Action Required:</strong> {pendingDeletions.length} exam(s) are pending permanent deletion.
                            The grace period has elapsed.
                        </span>
                    </div>
                    <div className="banner-actions">
                        {pendingDeletions.map(ex => (
                            <button key={ex.id} className="btn-banner-confirm" onClick={() => handleFinalDelete(ex)}>
                                <Trash2 size={14} /> Wipe "{ex.title}"
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="app-main-layout">
                {/* Topbar */}
                <header className="topbar">
                    <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    <div className="topbar-brand">
                        <GraduationCap size={24} />
                        <span>Classify</span>
                    </div>
                    <div className="topbar-spacer" />
                    <div className="flex items-center gap-12">
                        <span className="user-role">
                            {user?.role}
                        </span>
                        <div className="topbar-user-wrap">
                            <NavLink to="/profile" className="topbar-user-link">
                                <div className="avatar">{initials}</div>
                                <span className="user-name">
                                    {displayName}
                                </span>
                            </NavLink>
                            <button onClick={handleLogout} className="logout-btn" title="Logout">
                                <LogOut size={16} />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Sidebar Backdrop (Mobile) */}
                {isSidebarOpen && <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

                {/* Sidebar */}
                <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                    {nav.map(group => {
                        const visibleItems = group.items.filter(
                            item => !item.roles || item.roles.includes(user?.role)
                        );
                        if (!visibleItems.length) return null;
                        return (
                            <div key={group.section}>
                                <div className="sidebar-section">{group.section}</div>
                                {visibleItems.map(item => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                                        onClick={() => setIsSidebarOpen(false)}
                                    >
                                        <item.icon size={18} />
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        );
                    })}
                </aside>

                {/* Main content */}
                <main className="main-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
