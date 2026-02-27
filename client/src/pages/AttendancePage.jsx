import { useEffect, useState } from 'react';
import { ClipboardCheck, Download } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function AttendancePage() {
    const toast = useToast();
    const [courses, setCourses] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [report, setReport] = useState([]);
    const [loading, setLoading] = useState(false);
    const [depts, setDepts] = useState([]);

    // Mark attendance state
    const [markCourse, setMarkCourse] = useState('');
    const [markSession, setMarkSession] = useState('');
    const [markDate, setMarkDate] = useState(new Date().toISOString().substring(0, 10));
    const [students, setStudents] = useState([]); // enrolled students
    const [attendance, setAttendance] = useState({}); // { studentId: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED' }
    const [marking, setMarking] = useState(false);

    // Report filter
    const [repCourse, setRepCourse] = useState('');
    const [repDate, setRepDate] = useState('');
    const [tab, setTab] = useState('mark');

    // Live session state
    const [activeSessions, setActiveSessions] = useState([]);
    const [sessCourse, setSessCourse] = useState('');
    const [sessSemester, setSessSemester] = useState('');
    const [sessDept, setSessDept] = useState('');
    const [sessLevel, setSessLevel] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const [cRes, sRes, liveRes, dRes, curRes] = await Promise.all([
                    api.get('/courses'),
                    api.get('/sessions'),
                    api.get('/attendance/active-sessions'),
                    api.get('/departments'),
                    api.get('/sessions/current')
                ]);
                setCourses(cRes.data.data || []);
                setSessions(sRes.data || []);
                setActiveSessions(liveRes.data || []);
                setDepts(dRes.data || []);
                if (curRes.data) {
                    setMarkSession(curRes.data.id);
                    setSessSemester(curRes.data.id);
                }
            } catch { }
        })();
    }, []);

    const startSession = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/attendance/session', {
                courseId: sessCourse,
                semesterId: sessSemester,
                departmentId: sessDept || undefined,
                level: sessLevel || undefined
            });
            toast('Attendance session started! 🚀');
            // Refresh sessions to get names/relations
            const liveRes = await api.get('/attendance/active-sessions');
            setActiveSessions(liveRes.data || []);
            setSessCourse(''); setSessDept(''); setSessLevel('');
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to start session', 'error');
        }
    };

    const endSession = async (id) => {
        try {
            await api.put(`/attendance/session/${id}/end`);
            toast('Session ended ✅');
            setActiveSessions(prev => prev.filter(s => s.id !== id));
        } catch {
            toast('Failed to end session', 'error');
        }
    };

    useEffect(() => {
        if (!markCourse) { setStudents([]); return; }
        (async () => {
            try {
                const { data } = await api.get(`/courses/${markCourse}/students`);
                setStudents(data || []);
                const init = {};
                (data || []).forEach(e => { init[e.student?.id] = 'PRESENT'; });
                setAttendance(init);
            } catch { }
        })();
    }, [markCourse]);

    const handleMark = async (e) => {
        e.preventDefault();
        if (!markCourse || !markSession) { toast('Select course and semester', 'error'); return; }
        const records = Object.entries(attendance).map(([studentId, status]) => ({ studentId, status }));
        setMarking(true);
        try {
            await api.post('/attendance/mark', { courseId: markCourse, semesterId: markSession, date: markDate, records });
            toast(`Attendance marked for ${records.length} students`);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to mark attendance', 'error');
        }
        setMarking(false);
    };

    const loadReport = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/attendance/report', { params: { courseId: repCourse || undefined, date: repDate || undefined } });
            setReport(data || []);
        } catch { }
        setLoading(false);
    };

    const handleExport = async () => {
        try {
            const { data } = await api.get('/attendance/export', { params: { courseId: repCourse || undefined }, responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([data]));
            const a = document.createElement('a');
            a.href = url; a.download = 'attendance.csv'; a.click();
        } catch { toast('Export failed', 'error'); }
    };

    const statusColors = { PRESENT: 'badge-green', ABSENT: 'badge-red', LATE: 'badge-amber', EXCUSED: 'badge-blue' };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendance</h1>
                    <p className="page-subtitle">Mark and view attendance records</p>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab-btn ${tab === 'mark' ? 'active' : ''}`} onClick={() => setTab('mark')}>Mark Attendance</button>
                <button className={`tab-btn ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>View Report</button>
                <button className={`tab-btn ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>Live Sessions</button>
            </div>

            {tab === 'sessions' && (
                <div className="flex flex-col gap-24">
                    <form className="card" onSubmit={startSession}>
                        <h2 className="mb-16" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Start New Session</h2>
                        <div className="form-row mb-16">
                            <div className="form-group">
                                <label>Course</label>
                                <select required value={sessCourse} onChange={e => setSessCourse(e.target.value)}>
                                    <option value="">Select course...</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Semester</label>
                                <select required value={sessSemester} onChange={e => setSessSemester(e.target.value)}>
                                    <option value="">Select semester...</option>
                                    {sessions.map(s => <option key={s.id} value={s.id}>{s.session?.title} — {s.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Department (Optional)</label>
                                <select value={sessDept} onChange={e => setSessDept(e.target.value)}>
                                    <option value="">All Departments</option>
                                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Level (Optional)</label>
                                <select value={sessLevel} onChange={e => setSessLevel(e.target.value)}>
                                    <option value="">All Levels</option>
                                    {[100, 200, 300, 400, 500, 600].map(l => <option key={l} value={l}>{l}L</option>)}
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary">Start Live Session</button>
                    </form>

                    <div className="card">
                        <h2 className="mb-16" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Active Sessions</h2>
                        {activeSessions.length === 0 ? (
                            <div className="text-center py-24 text-muted">No active sessions right now</div>
                        ) : (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Course</th><th>Department</th><th>Level</th><th>Started</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {activeSessions.map(s => (
                                            <tr key={s.id}>
                                                <td className="font-600">{s.course?.code || s.courseId}</td>
                                                <td>{s.department?.name || 'All Departments'}</td>
                                                <td>{s.level ? `${s.level}L` : 'All Levels'}</td>
                                                <td className="text-muted">{new Date(s.startTime).toLocaleTimeString()}</td>
                                                <td>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => endSession(s.id)}>End Session</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'mark' && (
                <form onSubmit={handleMark}>
                    <div className="card mb-20">
                        <div className="form-row mb-16">
                            <div className="form-group">
                                <label>Course *</label>
                                <select required value={markCourse} onChange={e => setMarkCourse(e.target.value)}>
                                    <option value="">Select course…</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Semester *</label>
                                <select required value={markSession} onChange={e => setMarkSession(e.target.value)}>
                                    <option value="">Select semester…</option>
                                    {sessions.map(s => <option key={s.id} value={s.id}>{s.session?.title} — {s.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Date *</label>
                                <input type="date" required value={markDate} onChange={e => setMarkDate(e.target.value)} />
                            </div>
                        </div>

                        {markCourse && students.length === 0 && (
                            <div className="empty p-24"><p>No students enrolled in this course</p></div>
                        )}

                        {students.length > 0 && (
                            <>
                                <div className="flex items-center justify-between mb-12">
                                    <span className="text-09 font-600">{students.length} Students</span>
                                    <div className="flex gap-8">
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                                            const a = {}; students.forEach(e => { a[e.student?.id] = 'PRESENT'; }); setAttendance(a);
                                        }}>Mark All Present</button>
                                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                                            const a = {}; students.forEach(e => { a[e.student?.id] = 'ABSENT'; }); setAttendance(a);
                                        }}>Mark All Absent</button>
                                    </div>
                                </div>
                                <div className="table-wrap">
                                    <table>
                                        <thead><tr><th>Name</th><th>Matric No.</th><th>Status</th></tr></thead>
                                        <tbody>
                                            {students.map(e => {
                                                const sid = e.student?.id;
                                                return (
                                                    <tr key={sid}>
                                                        <td className="font-600">{e.student?.firstName} {e.student?.lastName}</td>
                                                        <td className="font-mono text-082 text-muted">{e.student?.matricNumber}</td>
                                                        <td>
                                                            <div className="flex gap-8">
                                                                {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(s => (
                                                                    <button key={s} type="button"
                                                                        className={`btn btn-sm att-btn ${attendance[sid] === s ? 'btn-primary' : 'btn-secondary'}`}
                                                                        onClick={() => setAttendance(a => ({ ...a, [sid]: s }))}>
                                                                        {s}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-16">
                                    <button type="submit" className="btn btn-primary" disabled={marking}>
                                        <ClipboardCheck size={16} />
                                        {marking ? 'Saving…' : 'Save Attendance'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </form>
            )}

            {tab === 'report' && (
                <div>
                    <div className="card mb-16">
                        <div className="flex items-center gap-12 flex-wrap">
                            <select value={repCourse} onChange={e => setRepCourse(e.target.value)} className="flex-1">
                                <option value="">All Courses</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                            </select>
                            <input type="date" value={repDate} onChange={e => setRepDate(e.target.value)} className="w-180" />
                            <button className="btn btn-primary" onClick={loadReport} disabled={loading}>
                                {loading ? 'Loading…' : 'Generate Report'}
                            </button>
                            <button className="btn btn-secondary" onClick={handleExport}>
                                <Download size={16} /> Export CSV
                            </button>
                        </div>
                    </div>

                    {report.length > 0 && (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Date</th><th>Student</th><th>Matric No.</th><th>Course</th><th>Status</th><th>Note</th></tr></thead>
                                <tbody>
                                    {report.map(a => (
                                        <tr key={a.id}>
                                            <td>{new Date(a.date).toLocaleDateString()}</td>
                                            <td className="font-600">{a.student?.firstName} {a.student?.lastName}</td>
                                            <td className="font-mono text-082 text-muted">{a.student?.matricNumber}</td>
                                            <td className="text-085">{a.course?.code}</td>
                                            <td><span className={`badge ${statusColors[a.status]}`}>{a.status}</span></td>
                                            <td className="text-muted text-082">{a.note || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
