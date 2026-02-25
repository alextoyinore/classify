import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import api from '../api';

export default function CbtResults() {
    const { id } = useParams();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get(`/cbt/attempts/${id}/result`);
                setResult(data);
            } catch { }
            setLoading(false);
        })();
    }, [id]);

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
    if (!result) return <div className="empty"><p>Results not found.</p></div>;

    const { attempt, answers } = result;
    const passed = attempt?.isPassed;

    return (
        <div>
            <Link to="/cbt/exam" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
                <ArrowLeft size={14} /> Back to Exams
            </Link>

            {/* Result summary card */}
            <div className="card" style={{ marginBottom: 24, textAlign: 'center', padding: 40 }}>
                <div style={{ marginBottom: 16 }}>
                    {passed
                        ? <CheckCircle size={64} color="var(--accent)" style={{ margin: '0 auto' }} />
                        : <XCircle size={64} color="var(--danger)" style={{ margin: '0 auto' }} />
                    }
                </div>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
                    {passed ? 'Congratulations!' : 'Better luck next time'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{attempt?.exam?.title}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: passed ? 'var(--accent)' : 'var(--danger)' }}>
                            {attempt?.percentage?.toFixed(1)}%
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Score</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                            {attempt?.score?.toFixed(1)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Points</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--amber)' }}>
                            {attempt?.exam?.passMark}%
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pass Mark</div>
                    </div>
                </div>
                <span className={`badge ${passed ? 'badge-green' : 'badge-red'}`} style={{ marginTop: 24, fontSize: '1rem', padding: '8px 24px' }}>
                    {passed ? 'PASSED' : 'FAILED'}
                </span>
            </div>

            {/* Per-question breakdown */}
            {attempt?.exam?.allowReview && answers?.length > 0 && (
                <div className="card">
                    <h2 style={{ marginBottom: 16, fontWeight: 700 }}>Question Review</h2>
                    {answers.map((a, idx) => (
                        <div key={a.id} style={{
                            padding: '16px 0', borderBottom: '1px solid var(--border)',
                        }}>
                            <div className="flex items-center gap-12" style={{ marginBottom: 10 }}>
                                {a.isCorrect
                                    ? <CheckCircle size={18} color="var(--accent)" />
                                    : <XCircle size={18} color="var(--danger)" />
                                }
                                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Q{idx + 1}</span>
                                <span style={{ fontSize: '0.9rem' }}>{a.question?.questionText}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingLeft: 30 }}>
                                {['A', 'B', 'C', 'D'].map(opt => {
                                    const isCorrect = opt === a.question?.correctOption;
                                    const isSelected = opt === a.selected;
                                    return (
                                        <div key={opt} style={{
                                            padding: '6px 10px', borderRadius: 6, fontSize: '0.82rem',
                                            background: isCorrect ? 'rgba(0,201,167,0.15)' : isSelected && !isCorrect ? 'var(--danger-dim)' : 'var(--bg-secondary)',
                                            border: `1px solid ${isCorrect ? 'var(--accent)' : isSelected && !isCorrect ? 'var(--danger)' : 'var(--border)'}`,
                                        }}>
                                            <strong>{opt}.</strong> {a.question?.[`option${opt}`]}
                                            {isSelected && <span style={{ marginLeft: 8, fontSize: '0.75rem' }}>← Your answer</span>}
                                        </div>
                                    );
                                })}
                            </div>
                            {a.question?.explanation && (
                                <div style={{ marginTop: 8, paddingLeft: 30, fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    💡 {a.question.explanation}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
