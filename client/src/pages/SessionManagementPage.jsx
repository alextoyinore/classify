import { useEffect, useState } from 'react';
import { Calendar, Plus, Trash2, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function SessionManagementPage() {
    const toast = useToast();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState('');
    const [setAsCurrent, setSetAsCurrent] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const { data } = await api.get('/sessions/raw');
            setSessions(data);
        } catch (err) {
            toast('Failed to load sessions', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.post('/sessions', { title, setAsCurrent });
            toast('Academic session created! 🎓');
            setTitle('');
            setSetAsCurrent(false);
            fetchSessions();
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to create session', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? This will delete all semesters and possibly affect attendance/exams associated with this session.')) return;
        try {
            await api.delete(`/sessions/${id}`);
            toast('Session deleted');
            fetchSessions();
        } catch {
            toast('Failed to delete session', 'error');
        }
    };

    const setSessionCurrent = async (id) => {
        try {
            await api.put(`/sessions/${id}/set-current`);
            toast('Session status updated');
            fetchSessions();
        } catch {
            toast('Failed to update session status', 'error');
        }
    };

    const setSemesterCurrent = async (id) => {
        try {
            await api.put(`/sessions/semesters/${id}/set-current`);
            toast('Semester status updated');
            fetchSessions();
        } catch {
            toast('Failed to update semester status', 'error');
        }
    };

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Academic Calendar</h1>
                    <p className="page-subtitle">Manage academic years and semesters</p>
                </div>
            </div>

            <div className="grid grid-3 gap-24 mt-24">
                <div className="md-col-span-1">
                    <form className="card" onSubmit={handleCreate}>
                        <div className="flex items-center gap-12 mb-20">
                            <div className="stat-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', padding: 8, borderRadius: 8 }}>
                                <Plus size={20} />
                            </div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>New Session</h2>
                        </div>

                        <div className="form-group mb-16">
                            <label>Session Title</label>
                            <input
                                placeholder="e.g. 2024/2025"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div className="flex items-center gap-8 mb-24">
                            <input
                                type="checkbox"
                                id="setAsCurrent"
                                checked={setAsCurrent}
                                onChange={e => setSetAsCurrent(e.target.checked)}
                            />
                            <label htmlFor="setAsCurrent" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Set as Current Session</label>
                        </div>

                        <button type="submit" className="btn btn-primary w-full" disabled={creating}>
                            {creating ? 'Creating...' : 'Create Session'}
                        </button>
                    </form>

                    <div className="card mt-24" style={{ background: 'var(--amber-dim)', borderColor: 'var(--amber)' }}>
                        <div className="flex gap-12">
                            <AlertCircle size={20} style={{ color: 'var(--amber)', flexShrink: 0 }} />
                            <div>
                                <h4 style={{ color: 'var(--amber)', marginBottom: 4 }}>Manage Carefully</h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Changing the current session or semester affects the entire platform, including attendance tracking and result computation.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md-col-span-2 flex flex-col gap-24">
                    {sessions.length === 0 ? (
                        <div className="card text-center py-48 text-muted">
                            <Calendar size={48} className="mb-16 mx-auto" style={{ opacity: 0.2 }} />
                            <p>No academic sessions defined yet.</p>
                        </div>
                    ) : (
                        sessions.map(session => (
                            <div key={session.id} className={`card ${session.isCurrent ? 'active-border' : ''}`} style={{ borderLeft: session.isCurrent ? '4px solid var(--accent)' : '1px solid var(--border)' }}>
                                <div className="flex items-center justify-between mb-20">
                                    <div className="flex items-center gap-12">
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{session.title}</h3>
                                        {session.isCurrent && <span className="badge badge-green">Current Session</span>}
                                    </div>
                                    <div className="flex gap-12">
                                        {!session.isCurrent && (
                                            <button className="btn btn-sm btn-secondary" onClick={() => setSessionCurrent(session.id)}>
                                                Set Current
                                            </button>
                                        )}
                                        <button className="btn btn-sm btn-icon text-red" onClick={() => handleDelete(session.id)} title="Delete Session">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-2 gap-16">
                                    {session.semesters.map(semester => (
                                        <div key={semester.id} className={`card p-12 ${semester.isCurrent ? 'bg-accent-dim' : 'bg-gray-50'}`} style={{ border: '1px solid var(--border)', background: semester.isCurrent ? 'var(--accent-dim)' : 'transparent' }}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-8">
                                                    {semester.isCurrent ?
                                                        <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} /> :
                                                        <Circle size={16} style={{ color: 'var(--text-muted)' }} />
                                                    }
                                                    <span style={{ fontWeight: 600 }}>{semester.name} SEMESTER</span>
                                                </div>
                                                {!semester.isCurrent && session.isCurrent && (
                                                    <button className="btn btn-xs btn-primary" onClick={() => setSemesterCurrent(semester.id)}>
                                                        Activate
                                                    </button>
                                                )}
                                            </div>
                                            <div className="mt-8 text-muted" style={{ fontSize: '0.8rem' }}>
                                                {semester.isCurrent ? 'Currently accepting academic records' : 'Inactive'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

// Add these to index.css if not present:
// .md-col-span-1 { grid-column: span 1; }
// .md-col-span-2 { grid-column: span 2; }
// .bg-accent-dim { background: var(--accent-dim); }
