import { useEffect, useState } from 'react';
import { FileText, Trophy, Target, Clock, Calendar } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function MyResultsPage() {
    const toast = useToast();
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/students/results/aggregate');
            // Backend returns an array even for one student if filtering by studentId or role
            setResults(data[0] || null);
        } catch (err) {
            toast('Failed to load your results', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

    if (!results) return (
        <div className="empty">
            <FileText size={48} />
            <p>No results found for the current semester</p>
        </div>
    );

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Academic Performance</h1>
                    <p className="page-subtitle">Semester aggregate of attendance, tests, and exams</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 32 }}>
                {results.courses.map((c) => (
                    <div key={c.courseCode} className="card hover-scale" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: 20, borderBottom: '1px solid var(--border)', background: 'var(--bg-inset)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.courseCode}</div>
                                    <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{c.courseTitle}</h3>
                                </div>
                                <div className="badge badge-blue" style={{ fontSize: '1.1rem', padding: '8px 12px', borderRadius: ' var(--radius-md)' }}>
                                    {c.total}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Attendance */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                                        <Clock size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Attendance Score</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{c.attendance.score} / {c.attendance.weight}</span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', background: 'var(--green)', width: `${(c.attendance.score / c.attendance.weight) * 100}%` }} />
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                            Attended {c.attendance.present} of {c.attendance.total} sessions
                                        </div>
                                    </div>
                                </div>

                                {/* Tests */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
                                        <Target size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tests (CBT)</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{c.test.score} / {c.test.max}</span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', background: 'var(--amber)', width: c.test.max > 0 ? `${(c.test.score / c.test.max) * 100}%` : '0%' }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Examination */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--purple-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple)' }}>
                                        <Trophy size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Exams</span>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{c.exam.score} / {c.exam.max}</span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--bg-inset)', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', background: 'var(--purple)', width: c.exam.max > 0 ? `${(c.exam.score / c.exam.max) * 100}%` : '0%' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
