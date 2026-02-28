import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, Award, Percent, Download, FileText, CheckCircle, XCircle } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function CbtAnalytics() {
    const { id } = useParams();
    const toast = useToast();
    const [exam, setExam] = useState(null);
    const [attempts, setAttempts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [eRes, rRes] = await Promise.all([
                    api.get(`/cbt/exams/${id}`),
                    api.get(`/cbt/exams/${id}/results`)
                ]);
                setExam(eRes.data);
                setAttempts(rRes.data.attempts || []);
            } catch (err) {
                toast('Failed to load analytics', 'error');
            }
            setLoading(false);
        })();
    }, [id]);

    const handleExport = () => {
        if (!attempts.length) return;
        const headers = ['Name', 'Matric Number', 'Score', 'Percentage', 'Status', 'Submitted At'];
        const rows = attempts.map(a => [
            `${a.student?.firstName} ${a.student?.lastName}`,
            a.student?.matricNumber,
            a.score,
            `${a.percentage}%`,
            a.isPassed ? 'PASSED' : 'FAILED',
            new Date(a.submittedAt).toLocaleString()
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${exam?.title}_results.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
    if (!exam) return <div className="empty"><p>Exam not found.</p></div>;

    const totalParticipants = attempts.length;
    const passedCount = attempts.filter(a => a.isPassed).length;
    const passRate = totalParticipants > 0 ? Math.round((passedCount / totalParticipants) * 100) : 0;
    const avgPercentage = totalParticipants > 0 ? (attempts.reduce((acc, a) => acc + a.percentage, 0) / totalParticipants).toFixed(1) : 0;

    return (
        <div className="animate-in">
            <Link to="/exams" className="btn btn-secondary btn-sm mb-20">
                <ArrowLeft size={14} /> Back to Exams
            </Link>

            <div className="page-header" style={{ marginBottom: 32 }}>
                <div>
                    <h1 className="page-title">{exam.title}</h1>
                    <p className="page-subtitle">{exam.course?.code} — Examination Result Analytics</p>
                </div>
                <button className="btn btn-secondary" onClick={handleExport} disabled={attempts.length === 0}>
                    <Download size={16} /> Export Results (CSV)
                </button>
            </div>

            <div className="grid grid-3 mb-32" style={{ gap: 20 }}>
                <div className="card text-center">
                    <div className="stat-icon m-auto mb-12" style={{ background: 'var(--info-dim)', color: 'var(--info)' }}>
                        <Users size={20} />
                    </div>
                    <div className="text-muted text-085 font-600 mb-4 uppercase">Participants</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalParticipants}</div>
                </div>
                <div className="card text-center">
                    <div className="stat-icon m-auto mb-12" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                        <Percent size={20} />
                    </div>
                    <div className="text-muted text-085 font-600 mb-4 uppercase">Pass Rate</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{passRate}%</div>
                </div>
                <div className="card text-center">
                    <div className="stat-icon m-auto mb-12" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                        <Award size={20} />
                    </div>
                    <div className="text-muted text-085 font-600 mb-4 uppercase">Avg. Score</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{avgPercentage}%</div>
                </div>
            </div>

            <div className="flex items-center justify-between mb-20">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Student Results</h2>
                <span className="badge badge-muted">{attempts.length} Records</span>
            </div>

            {attempts.length === 0 ? (
                <div className="card empty py-40">
                    <FileText size={48} />
                    <p>No student has completed this exam yet.</p>
                </div>
            ) : (
                <div className="table-wrap card" style={{ padding: 0 }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th>Matric Number</th>
                                <th>Score</th>
                                <th>Percentage</th>
                                <th>Status</th>
                                <th>Submitted At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attempts.map(a => (
                                <tr key={a.id}>
                                    <td>
                                        <div className="font-600">{a.student?.firstName} {a.student?.lastName}</div>
                                    </td>
                                    <td className="font-mono text-082 text-muted">{a.student?.matricNumber}</td>
                                    <td className="font-700">{a.score} / {exam.totalMarks}</td>
                                    <td>
                                        <div className="flex items-center gap-8">
                                            <div className="progress-bg" style={{ width: 60, height: 6, borderRadius: 3, background: 'var(--bg-secondary)' }}>
                                                <div className="progress-bar" style={{
                                                    width: `${a.percentage}%`,
                                                    height: '100%',
                                                    borderRadius: 3,
                                                    background: a.isPassed ? 'var(--accent)' : 'var(--danger)'
                                                }} />
                                            </div>
                                            <span className="font-600">{a.percentage}%</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge ${a.isPassed ? 'badge-green' : 'badge-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                            {a.isPassed ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                            {a.isPassed ? 'PASSED' : 'FAILED'}
                                        </span>
                                    </td>
                                    <td className="text-muted text-082">
                                        {new Date(a.submittedAt).toLocaleDateString()} {new Date(a.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
