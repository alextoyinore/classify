import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, BookOpen, ClipboardCheck, TrendingUp, Calendar, GraduationCap } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function StatCard({ icon: Icon, label, value, color, sub }) {
    return (
        <div className="stat-card">
            <div className="stat-icon" style={{ color }}>
                <Icon size={20} />
            </div>
            <div className="stat-value">{value ?? '—'}</div>
            <div className="stat-label">{label}</div>
            {sub && <div className="stat-sub">{sub}</div>}
        </div>
    );
}

export default function Dashboard() {
    const { user, isAdmin, isInstructor } = useAuth();
    const toast = useToast();
    const [stats, setStats] = useState(null);
    const [recentStudents, setRecentStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeSessions, setActiveSessions] = useState([]);
    const [marking, setMarking] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [sRes, iRes, cRes, sessRes] = await Promise.all([
                    isAdmin || isInstructor ? api.get('/students?limit=5') : Promise.resolve({ data: { data: [], total: 0 } }),
                    isAdmin ? api.get('/instructors?limit=1') : Promise.resolve({ data: { data: [], total: 0 } }),
                    api.get('/courses?limit=1'),
                    user?.role === 'STUDENT' ? api.get('/attendance/active-sessions') : Promise.resolve({ data: [] }),
                ]);
                setStats({
                    students: sRes.data.total,
                    instructors: iRes.data.total,
                    courses: cRes.data.total,
                });
                setRecentStudents(sRes.data.data?.slice(0, 5) || []);
                setActiveSessions(sessRes.data || []);
            } catch { }
            setLoading(false);
        })();
    }, [isAdmin, isInstructor, user?.role]);

    const handleSelfMark = async (courseId, semesterId) => {
        setMarking(true);
        try {
            await api.post('/attendance/self-mark', { courseId, semesterId });
            toast('Attendance marked successfully! ✅');
            setActiveSessions(prev => prev.filter(s => s.courseId !== courseId));
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to mark attendance', 'error');
        } finally {
            setMarking(false);
        }
    };

    const displayName = user?.profile?.firstName || user?.profile?.fullName?.split(' ')[0] || 'User';
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <div>
            <div className="page-header">
                <div className="flex items-center gap-12">
                    <div className="avatar" style={{ width: 48, height: 48 }}>
                        <GraduationCap size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">{greeting}, {displayName} 👋</h1>
                        <p className="page-subtitle">
                            {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-wrap"><div className="spinner" /></div>
            ) : (
                <>
                    <div className="stats-grid">
                        {(isAdmin || isInstructor) && (
                            <StatCard icon={Users} label="Total Students" value={stats?.students} color="var(--accent)" sub="Registered" />
                        )}
                        {isAdmin && (
                            <StatCard icon={UserCheck} label="Instructors" value={stats?.instructors} color="var(--amber)" sub="Staff" />
                        )}
                        <StatCard icon={BookOpen} label="Courses" value={stats?.courses} color="var(--info)" sub="Active" />
                        <StatCard icon={TrendingUp} label="Platform Status" value="Online" color="var(--accent)" sub="Local network" />
                    </div>

                    {(isAdmin || isInstructor) && recentStudents.length > 0 && (
                        <>
                            <div className="flex items-center justify-between mb-16">
                                <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Students</h2>
                                <Link to="/students" className="btn btn-secondary btn-sm">View All</Link>
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Matric No.</th>
                                            <th>Department</th>
                                            <th>Level</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentStudents.map(s => (
                                            <tr key={s.id}>
                                                <td>
                                                    <Link to={`/students/${s.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                                        {s.firstName} {s.lastName}
                                                    </Link>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{s.matricNumber}</td>
                                                <td>{s.department}</td>
                                                <td>{s.level}L</td>
                                                <td>
                                                    <span className={`badge ${s.isActive ? 'badge-green' : 'badge-red'}`}>
                                                        {s.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {user?.role === 'STUDENT' && (
                        <div className="flex flex-col gap-24">
                            {activeSessions.length > 0 && (
                                <div className="card attendance-vibe" style={{ background: 'var(--accent)', color: '#fff', textAlign: 'center' }}>
                                    <ClipboardCheck size={48} className="mb-12" style={{ opacity: 0.8 }} />
                                    <h2 className="mb-8" style={{ color: '#fff' }}>Live Class in Session!</h2>
                                    <p className="mb-24" style={{ opacity: 0.9 }}>
                                        {activeSessions[0].course.code}: {activeSessions[0].course.title} is currently active
                                        {activeSessions[0].department && ` for ${activeSessions[0].department.name}`}
                                        {activeSessions[0].level && ` (${activeSessions[0].level}L)`}.
                                    </p>
                                    <button
                                        className="btn btn-white w-full"
                                        onClick={() => handleSelfMark(activeSessions[0].courseId, activeSessions[0].semesterId)}
                                        disabled={marking}
                                    >
                                        {marking ? 'Marking...' : 'Mark Me Present'}
                                    </button>
                                </div>
                            )}

                            <div className="card student-welcome">
                                <GraduationCap size={48} className="welcome-icon" />
                                <h2 className="mb-8">Welcome back, {displayName}</h2>
                                <p className="text-secondary mb-24">
                                    Manage your courses, track attendance, and attempt CBT exams.
                                </p>
                                <div className="flex gap-12 justify-center">
                                    <Link to="/courses" className="btn btn-primary">My Courses</Link>
                                    <Link to="/cbt/exam" className="btn btn-secondary">CBT Exams</Link>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
