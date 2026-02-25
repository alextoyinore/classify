import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Book, ClipboardCheck, Award } from 'lucide-react';
import api from '../api';

function InfoRow({ icon: Icon, label, value }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-12" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <Icon size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: 120, flexShrink: 0 }}>{label}</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{value}</span>
        </div>
    );
}

export default function StudentProfile() {
    const { id } = useParams();
    const [student, setStudent] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [scores, setScores] = useState([]);
    const [tab, setTab] = useState('info');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [sRes, aRes, scRes] = await Promise.all([
                    api.get(`/students/${id}`),
                    api.get(`/students/${id}/attendance`),
                    api.get(`/students/${id}/scores`),
                ]);
                setStudent(sRes.data);
                setAttendance(aRes.data || []);
                setScores(scRes.data || []);
            } catch { }
            setLoading(false);
        })();
    }, [id]);

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
    if (!student) return <div className="empty"><p>Student not found.</p></div>;

    const s = student;
    const fullName = `${s.firstName}${s.middleName ? ' ' + s.middleName : ''} ${s.lastName}`;

    // Attendance summary
    const attTotal = attendance.length;
    const attPresent = attendance.filter(a => a.status === 'PRESENT').length;
    const attPct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : null;

    return (
        <div>
            <Link to="/students" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
                <ArrowLeft size={14} /> Back to Students
            </Link>

            {/* Header card */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
                <div className="avatar" style={{ width: 72, height: 72, fontSize: '1.5rem', borderRadius: '50%' }}>
                    {s.firstName[0]}{s.lastName[0]}
                </div>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>{fullName}</h1>
                    <div className="flex gap-8 flex-wrap" style={{ gap: 8 }}>
                        <span className="badge badge-blue">{s.level}L</span>
                        <span className="badge badge-muted">{s.department}</span>
                        <span className={`badge ${s.isActive ? 'badge-green' : 'badge-red'}`}>{s.isActive ? 'Active' : 'Inactive'}</span>
                        <span className="badge badge-muted" style={{ fontFamily: 'monospace' }}>{s.matricNumber}</span>
                    </div>
                </div>
                {attPct !== null && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: attPct >= 75 ? 'var(--accent)' : 'var(--danger)' }}>{attPct}%</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attendance</div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="tabs">
                {['info', 'attendance', 'scores'].map(t => (
                    <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                        {t === 'info' ? 'Profile' : t === 'attendance' ? 'Attendance' : 'Scores'}
                    </button>
                ))}
            </div>

            {tab === 'info' && (
                <div className="card">
                    <InfoRow icon={Mail} label="Email" value={s.user?.email} />
                    <InfoRow icon={Phone} label="Phone" value={s.phone} />
                    <InfoRow icon={MapPin} label="Address" value={s.address} />
                    <InfoRow icon={Calendar} label="Date of Birth" value={s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : null} />
                    <InfoRow icon={User} label="Gender" value={s.gender} />
                    <InfoRow icon={Book} label="Faculty" value={s.faculty} />
                    <InfoRow icon={Award} label="Entry Year" value={s.entryYear} />
                </div>
            )}

            {tab === 'attendance' && (
                attendance.length === 0 ? (
                    <div className="empty"><ClipboardCheck size={48} /><p>No attendance records yet</p></div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Date</th><th>Course</th><th>Status</th><th>Note</th></tr></thead>
                            <tbody>
                                {attendance.map(a => (
                                    <tr key={a.id}>
                                        <td>{new Date(a.date).toLocaleDateString()}</td>
                                        <td>{a.course?.code} — {a.course?.title}</td>
                                        <td>
                                            <span className={`badge ${a.status === 'PRESENT' ? 'badge-green' :
                                                    a.status === 'LATE' ? 'badge-amber' :
                                                        a.status === 'EXCUSED' ? 'badge-blue' : 'badge-red'
                                                }`}>{a.status}</span>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{a.note || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {tab === 'scores' && (
                scores.length === 0 ? (
                    <div className="empty"><Award size={48} /><p>No scores recorded yet</p></div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Exam</th><th>Course</th><th>Type</th><th>Score</th><th>Grade</th></tr></thead>
                            <tbody>
                                {scores.map(sc => (
                                    <tr key={sc.id}>
                                        <td style={{ fontWeight: 600 }}>{sc.exam?.title}</td>
                                        <td>{sc.exam?.course?.code}</td>
                                        <td><span className="badge badge-muted">{sc.exam?.type}</span></td>
                                        <td style={{ fontWeight: 700, color: sc.score >= 50 ? 'var(--accent)' : 'var(--danger)' }}>
                                            {sc.score} / {sc.exam?.totalMarks}
                                        </td>
                                        <td>
                                            <span className={`badge ${sc.grade === 'A' || sc.grade === 'B' ? 'badge-green' : sc.grade === 'C' ? 'badge-amber' : 'badge-red'}`}>
                                                {sc.grade || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}
        </div>
    );
}
