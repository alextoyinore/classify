import { useEffect, useState } from 'react';
import { ClipboardCheck, Download, UserPlus, Search } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const STATUS_COLORS = { PRESENT: 'badge-green', ABSENT: 'badge-red', LATE: 'badge-amber', EXCUSED: 'badge-blue' };

export default function AttendancePage() {
    const toast = useToast();
    const [courses,  setCourses]  = useState([]);
    const [sessions, setSessions] = useState([]);
    const [report,   setReport]   = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [depts,    setDepts]    = useState([]);

    // ─── Mark attendance state ──────────────────────────────
    const [markCourse,  setMarkCourse]  = useState('');
    const [markSession, setMarkSession] = useState('');
    const [markDate,    setMarkDate]    = useState(new Date().toISOString().substring(0, 10));
    const [students,    setStudents]    = useState([]);
    const [attendance,  setAttendance]  = useState({});
    const [marking,     setMarking]     = useState(false);

    // ─── Report filter ──────────────────────────────────────
    const [repCourse, setRepCourse] = useState('');
    const [repDate,   setRepDate]   = useState('');

    // ─── Tab ────────────────────────────────────────────────
    const [tab, setTab] = useState('mark');

    // ─── Live session state ─────────────────────────────────
    const [activeSessions, setActiveSessions] = useState([]);
    const [sessCourse,   setSessCourse]   = useState('');
    const [sessSemester, setSessSemester] = useState('');
    const [sessDept,     setSessDept]     = useState('');
    const [sessLevel,    setSessLevel]    = useState('');

    // ─── Makeup Attendance state
    const [makeupCourse, setMakeupCourse] = useState('');
    const [makeupSemester, setMakeupSemester] = useState('');
    const [makeupDept, setMakeupDept] = useState('');
    const [makeupLevel, setMakeupLevel] = useState('');
    const [makeupDate, setMakeupDate] = useState('');
    const [makeupStudents, setMakeupStudents] = useState([]);
    const [loadingMakeup, setLoadingMakeup] = useState(false);
    const [makingUp, setMakingUp] = useState(false);

    // ─── Init ────────────────────────────────────────────────
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
                    setMakeup(m => ({ ...m, semesterId: curRes.data.id }));
                }
            } catch { }
        })();
    }, []);

    // ─── Live sessions ───────────────────────────────────────
    const startSession = async (e) => {
        e.preventDefault();
        try {
            await api.post('/attendance/session', {
                courseId: sessCourse,
                semesterId: sessSemester,
                departmentId: sessDept  || undefined,
                level:        sessLevel || undefined
            });
            toast('Attendance session started! 🚀');
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

    const handleExtend = async (id) => {
        try {
            await api.put(`/attendance/session/${id}/extend`, { minutes: 30 });
            toast('Session extended by 30 mins ⏳');
            const liveRes = await api.get('/attendance/active-sessions');
            setActiveSessions(liveRes.data || []);
        } catch {
            toast('Failed to extend session', 'error');
        }
    };

    // ─── Students for course ─────────────────────────────────
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

    // ─── Mark attendance (bulk) ──────────────────────────────
    const handleMark = async (e) => {
        e.preventDefault();
        if (!markCourse || !markSession) { toast('Select course and semester', 'error'); return; }
        const records = Object.entries(attendance).map(([studentId, status]) => ({ studentId, status }));
        if (!records.length) { toast('No students to mark — check enrollment', 'error'); return; }
        setMarking(true);
        try {
            const { data } = await api.post('/attendance/mark', {
                courseId: markCourse, semesterId: markSession, date: markDate, records
            });
            toast(`Attendance marked for ${data.marked} students ✅`);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to mark attendance', 'error');
        }
        setMarking(false);
    };

    // ─── Report ──────────────────────────────────────────────
    const loadReport = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/attendance/report', {
                params: { courseId: repCourse || undefined, date: repDate || undefined }
            });
            setReport(data.records || data || []);
        } catch { toast('Failed to load report', 'error'); }
        setLoading(false);
    };

    const handleExport = async () => {
        try {
            const { data } = await api.get('/attendance/export', {
                params: { courseId: repCourse || undefined },
                responseType: 'blob'
            });
            const url = URL.createObjectURL(new Blob([data]));
            const a = document.createElement('a');
            a.href = url; a.download = 'attendance.csv'; a.click();
        } catch { toast('Export failed', 'error'); }
    };

    // ─── Makeup department student load ───────────────────────────────
    const fetchMakeupStudents = async () => {
        if (!makeupDept) {
            toast('Please select a department', 'error');
            return;
        }
        setLoadingMakeup(true);
        try {
            // Find department name for the query
            const dName = depts.find(d => d.id === makeupDept)?.name || '';
            const { data } = await api.get('/students', { 
                params: { 
                    department: dName, 
                    level: makeupLevel || undefined,
                    limit: 1000 
                } 
            });
            const formatted = (data.data || []).map(s => ({
                id: s.id,
                student: s,
                status: 'PRESENT',
                note: 'Makeup attendance'
            }));
            setMakeupStudents(formatted);
            if (formatted.length === 0) toast('No students found for this department');
        } catch { toast('Failed to load students', 'error'); }
        setLoadingMakeup(false);
    };

    const handleMakeupSubmit = async (e) => {
        e.preventDefault();
        if (!makeupCourse || !makeupSemester || !makeupDate || makeupStudents.length === 0) {
            toast('Fill required fields and load students', 'error'); return;
        }
        setMakingUp(true);
        try {
            const records = makeupStudents.map(s => ({
                studentId: s.student.id,
                status: s.status,
                note: s.note
            }));
            const { data } = await api.post('/attendance/mark', {
                courseId: makeupCourse,
                semesterId: makeupSemester,
                date: makeupDate,
                records
            });
            toast(`Successfully saved makeup attendance for ${data.marked} students ✅`);
            setMakeupStudents([]);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to save makeup attendance', 'error');
        }
        setMakingUp(false);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Attendance</h1>
                    <p className="page-subtitle">Mark and view attendance records</p>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab-btn ${tab === 'mark'    ? 'active' : ''}`} onClick={() => setTab('mark')}>Mark Attendance</button>
                <button className={`tab-btn ${tab === 'makeup'  ? 'active' : ''}`} onClick={() => setTab('makeup')}>Makeup Attendance</button>
                <button className={`tab-btn ${tab === 'report'  ? 'active' : ''}`} onClick={() => setTab('report')}>View Report</button>
                <button className={`tab-btn ${tab === 'sessions'? 'active' : ''}`} onClick={() => setTab('sessions')}>Live Sessions</button>
            </div>

            {/* ─── LIVE SESSIONS ──────────────────────────────── */}
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
                                    <thead><tr><th>Course</th><th>Department</th><th>Level</th><th>Started</th><th>Expires</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {activeSessions.map(s => (
                                            <tr key={s.id}>
                                                <td className="font-600">{s.course?.code || s.courseId}</td>
                                                <td>{s.department?.name || 'All Departments'}</td>
                                                <td>{s.level ? `${s.level}L` : 'All Levels'}</td>
                                                <td className="text-muted">{new Date(s.startTime).toLocaleTimeString()}</td>
                                                <td className="text-muted">{s.expiresAt ? new Date(s.expiresAt).toLocaleTimeString() : '—'}</td>
                                                <td>
                                                    <div className="flex gap-8">
                                                        <button className="btn btn-sm btn-secondary" onClick={() => handleExtend(s.id)}>+30m</button>
                                                        <button className="btn btn-sm btn-secondary" onClick={() => endSession(s.id)}>End Session</button>
                                                    </div>
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

            {/* ─── MARK ATTENDANCE ────────────────────────────── */}
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
                            <div className="empty p-24">
                                <p>No students enrolled in this course. Use <strong>Course → Enroll Students</strong> to add them first.</p>
                            </div>
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

            {/* ─── MAKEUP ATTENDANCE ──────────────────────────── */}
            {tab === 'makeup' && (
                <div className="flex flex-col gap-24">
                    <div className="card" style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)' }}>
                        <div className="flex items-center gap-10 mb-4">
                            <UserPlus size={18} style={{ color: 'var(--amber)' }} />
                            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--amber)' }}>Makeup Attendance</h2>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Use this to record attendance for a student who missed a previous session due to system issues or other circumstances. A past date can be selected.
                        </p>
                    </div>

                    <form className="card" onSubmit={handleMakeupSubmit}>
                        <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Create Bulk Makeup Record</h3>

                        <div className="form-row mb-16">
                            <div className="form-group">
                                <label>Course *</label>
                                <select required value={makeupCourse} onChange={e => setMakeupCourse(e.target.value)}>
                                    <option value="">Select course…</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Semester *</label>
                                <select required value={makeupSemester} onChange={e => setMakeupSemester(e.target.value)}>
                                    <option value="">Select semester…</option>
                                    {sessions.map(s => <option key={s.id} value={s.id}>{s.session?.title} — {s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-row mb-16">
                            <div className="form-group">
                                <label>Department *</label>
                                <select required value={makeupDept} onChange={e => setMakeupDept(e.target.value)}>
                                    <option value="">Select department…</option>
                                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Level (Optional)</label>
                                <select value={makeupLevel} onChange={e => setMakeupLevel(e.target.value)}>
                                    <option value="">All Levels</option>
                                    {[100, 200, 300, 400, 500, 600].map(l => <option key={l} value={l}>{l}L</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Date of Missed Class *</label>
                                <input type="date" required value={makeupDate} onChange={e => setMakeupDate(e.target.value)} />
                            </div>
                        </div>

                        <div className="mb-24">
                            <button type="button" className="btn btn-secondary" onClick={fetchMakeupStudents} disabled={loadingMakeup}>
                                <Users size={16} />
                                {loadingMakeup ? 'Loading Students…' : 'Fetch Department Students'}
                            </button>
                        </div>

                        {makeupStudents.length > 0 && (
                            <>
                                <div className="table-responsive">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Status</th>
                                                <th>Note</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {makeupStudents.map((s, idx) => (
                                                <tr key={s.student.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{s.student.firstName} {s.student.lastName}</div>
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                            {s.student.matricNumber}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex gap-12">
                                                            {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(status => (
                                                                <label key={status} className="flex items-center gap-6" style={{ fontSize: '0.82rem', cursor: 'pointer' }}>
                                                                    <input
                                                                        type="radio"
                                                                        name={`makeup_status_${s.student.id}`}
                                                                        checked={s.status === status}
                                                                        onChange={() => {
                                                                            const copy = [...makeupStudents];
                                                                            copy[idx].status = status;
                                                                            setMakeupStudents(copy);
                                                                        }}
                                                                    />
                                                                    <span style={{
                                                                        color: status === 'PRESENT' ? 'var(--green)' : status === 'ABSENT' ? 'var(--danger)' : status === 'LATE' ? 'var(--amber)' : 'var(--text-secondary)',
                                                                        fontWeight: s.status === status ? 700 : 400
                                                                    }}>
                                                                        {status}
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            placeholder="Note..."
                                                            value={s.note || ''}
                                                            onChange={e => {
                                                                const copy = [...makeupStudents];
                                                                copy[idx].note = e.target.value;
                                                                setMakeupStudents(copy);
                                                            }}
                                                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-16">
                                    <button type="submit" className="btn btn-primary" disabled={makingUp}>
                                        <ClipboardCheck size={16} />
                                        {makingUp ? 'Saving Makeup Attendance…' : 'Save Bulk Makeup Records'}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            )}

            {/* ─── REPORT ─────────────────────────────────────── */}
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
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Student</th>
                                        <th>Matric No.</th>
                                        <th>Course</th>
                                        <th>Status</th>
                                        <th>Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.map(a => (
                                        <tr key={a.id}>
                                            <td>{new Date(a.date).toLocaleDateString()}</td>
                                            <td className="font-600">{a.student?.firstName} {a.student?.lastName}</td>
                                            <td className="font-mono text-082 text-muted">{a.student?.matricNumber}</td>
                                            <td className="text-085">{a.course?.code}</td>
                                            <td><span className={`badge ${STATUS_COLORS[a.status]}`}>{a.status}</span></td>
                                            <td className="text-muted text-082">{a.note || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {report.length === 0 && !loading && (
                        <div className="empty py-40">
                            <ClipboardCheck size={48} />
                            <p>Generate a report to view records</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
