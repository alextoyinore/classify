import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, UserCheck, BookOpen } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function CourseDetail() {
    const { id } = useParams();
    const toast = useToast();
    const { isAdmin } = useAuth();
    const [course, setCourse] = useState(null);
    const [students, setStudents] = useState([]);
    const [tab, setTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [matricList, setMatricList] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [session, setSession] = useState(new Date().getFullYear() + '/' + (new Date().getFullYear() + 1));
    const [semester, setSemester] = useState('FIRST');

    useEffect(() => {
        (async () => {
            try {
                const [cRes, sRes] = await Promise.all([
                    api.get(`/courses/${id}`),
                    api.get(`/courses/${id}/students`),
                ]);
                setCourse(cRes.data);
                setStudents(sRes.data || []);
            } catch { }
            setLoading(false);
        })();
    }, [id]);

    const handleEnroll = async (e) => {
        e.preventDefault();
        const matrics = matricList.split(/[\n,]+/).map(m => m.trim()).filter(Boolean);
        if (!matrics.length) return;
        setEnrolling(true);
        try {
            await api.post(`/courses/${id}/enroll`, { matricNumbers: matrics, session, semester });
            toast(`Enrolled ${matrics.length} student(s)`);
            setMatricList('');
            const { data } = await api.get(`/courses/${id}/students`);
            setStudents(data || []);
        } catch (err) {
            toast(err.response?.data?.error || 'Enrollment failed', 'error');
        }
        setEnrolling(false);
    };

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
    if (!course) return <div className="empty"><p>Course not found.</p></div>;

    return (
        <div>
            <Link to="/courses" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
                <ArrowLeft size={14} /> Back to Courses
            </Link>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="flex items-center gap-12 flex-wrap">
                    <div className="stat-icon" style={{ background: 'var(--info-dim)', color: 'var(--info)', width: 52, height: 52 }}>
                        <BookOpen size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>{course.code}</div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>{course.title}</h1>
                        <div className="flex gap-8 flex-wrap" style={{ gap: 8 }}>
                            <span className="badge badge-blue">{course.level}L</span>
                            <span className="badge badge-muted">{course.department}</span>
                            <span className="badge badge-amber">{course.creditUnits} Credits</span>
                            <span className={`badge ${course.isActive ? 'badge-green' : 'badge-red'}`}>{course.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{students.length}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Enrolled</div>
                    </div>
                </div>
                {course.description && <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{course.description}</p>}
            </div>

            <div className="tabs">
                {['overview', 'students', isAdmin && 'enroll'].filter(Boolean).map(t => (
                    <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                        {t === 'overview' ? 'Instructors' : t === 'students' ? `Students (${students.length})` : 'Enroll Students'}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="card">
                    {course.instructors?.length > 0 ? (
                        <div>
                            {course.instructors.map(ci => (
                                <div key={ci.id} className="flex items-center gap-12" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                    <div className="avatar" style={{ width: 36, height: 36, fontSize: '0.75rem' }}>
                                        {ci.instructor?.firstName?.[0]}{ci.instructor?.lastName?.[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{ci.instructor?.firstName} {ci.instructor?.lastName}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ci.instructor?.staffId}</div>
                                    </div>
                                    {ci.isPrimary && <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Primary</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty"><UserCheck size={48} /><p>No instructors assigned</p></div>
                    )}
                </div>
            )}

            {tab === 'students' && (
                students.length === 0 ? (
                    <div className="empty"><Users size={48} /><p>No students enrolled yet</p></div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Name</th><th>Matric No.</th><th>Level</th><th>Session</th><th>Semester</th></tr></thead>
                            <tbody>
                                {students.map(e => (
                                    <tr key={e.id}>
                                        <td>
                                            <Link to={`/students/${e.student?.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                                {e.student?.firstName} {e.student?.lastName}
                                            </Link>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{e.student?.matricNumber}</td>
                                        <td><span className="badge badge-blue">{e.student?.level}L</span></td>
                                        <td style={{ fontSize: '0.85rem' }}>{e.session}</td>
                                        <td><span className="badge badge-muted">{e.semester}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {tab === 'enroll' && isAdmin && (
                <div className="card">
                    <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Enroll Students</h3>
                    <form onSubmit={handleEnroll} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Academic Session</label>
                                <input value={session} onChange={e => setSession(e.target.value)} placeholder="e.g. 2024/2025" />
                            </div>
                            <div className="form-group">
                                <label>Semester</label>
                                <select value={semester} onChange={e => setSemester(e.target.value)}>
                                    <option value="FIRST">First Semester</option>
                                    <option value="SECOND">Second Semester</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Matric Numbers (one per line or comma-separated)</label>
                            <textarea
                                rows={6}
                                placeholder="CSC/2021/001&#10;CSC/2021/002&#10;CSC/2021/003"
                                value={matricList}
                                onChange={e => setMatricList(e.target.value)}
                            />
                        </div>
                        <div>
                            <button type="submit" className="btn btn-primary" disabled={enrolling || !matricList.trim()}>
                                {enrolling ? 'Enrolling…' : 'Enroll Students'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
