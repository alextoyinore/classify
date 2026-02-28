import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, UserCheck, BookOpen, ClipboardCheck,
    FileText, Monitor, Cloud, Settings, LogOut, GraduationCap,
    ChevronRight, User, Building2, Calendar, Menu, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const displayName = user?.profile?.firstName || user?.profile?.fullName || user?.email || 'User';
    const initials = (user?.profile?.firstName || user?.profile?.fullName || user?.email || '?').substring(0, 2).toUpperCase();

    return (
        <div className="app-shell">
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
    );
}
