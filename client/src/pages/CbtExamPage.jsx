import { useEffect, useState, useRef } from 'react';
import { Flag, ChevronLeft, ChevronRight, GraduationCap } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export default function CbtExamPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [availExams, setAvailExams] = useState([]);
    const [selected, setSelected] = useState(null); // exam to start
    const [attempt, setAttempt] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [flagged, setFlagged] = useState(new Set());
    const [current, setCurrent] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [phase, setPhase] = useState('list'); // 'list' | 'exam' | 'submitted'
    const [submitting, setSubmitting] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/cbt/exams?published=true');
                setAvailExams(data.data || []);
            } catch { }
        })();
    }, []);

    const startExam = async (exam) => {
        try {
            const { data } = await api.post(`/cbt/exams/${exam.id}/start`);
            setAttempt(data.attempt);
            setQuestions(data.questions || []);
            setTimeLeft(exam.durationMinutes * 60);
            setPhase('exam');
            setAnswers({});
            setFlagged(new Set());
            setCurrent(0);
        } catch (err) {
            toast(err.response?.data?.error || 'Could not start exam', 'error');
        }
    };

    // Countdown timer
    useEffect(() => {
        if (phase !== 'exam') return;
        timerRef.current = setInterval(() => {
            setTimeLeft(t => {
                if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [phase]);

    const handleSubmit = async (auto = false) => {
        if (!auto && !confirm('Submit exam? You cannot change answers after submitting.')) return;
        clearInterval(timerRef.current);
        setSubmitting(true);
        try {
            const answerList = Object.entries(answers).map(([questionId, selected]) => ({ questionId, selected }));
            const { data } = await api.post(`/cbt/attempts/${attempt.id}/submit`, { answers: answerList });
            setPhase('submitted');
            navigate(`/cbt/results/${attempt.id}`);
        } catch (err) {
            toast(err.response?.data?.error || 'Submission failed', 'error');
        }
        setSubmitting(false);
    };

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const q = questions[current];

    if (phase === 'list') {
        return (
            <div>
                <div className="page-header">
                    <div>
                        <h1 className="page-title">My CBT Exams</h1>
                        <p className="page-subtitle">Published exams available to you</p>
                    </div>
                </div>
                {availExams.length === 0 ? (
                    <div className="empty"><GraduationCap size={48} /><p>No exams available right now</p></div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
                        {availExams.map(ex => (
                            <div key={ex.id} className="card">
                                <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>{ex.course?.code}</div>
                                <h3 style={{ marginBottom: 8, fontWeight: 700 }}>{ex.title}</h3>
                                <div className="flex gap-8" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                                    <span className="badge badge-blue">{ex.durationMinutes} min</span>
                                    <span className="badge badge-amber">{ex.questions?.length || 0} questions</span>
                                    <span className="badge badge-muted">Pass: {ex.passMark}%</span>
                                </div>
                                {ex.instructions && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{ex.instructions}</p>}
                                <button className="btn btn-primary w-full" style={{ justifyContent: 'center' }} onClick={() => startExam(ex)}>
                                    Start Exam
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Full-screen exam interface
    return (
        <div className="cbt-shell">
            {/* Exam topbar */}
            <header className="topbar">
                <div className="topbar-brand"><GraduationCap size={22} /> {attempt?.exam?.title}</div>
                <div className="topbar-spacer" />
                <div style={{
                    fontSize: '1.3rem', fontWeight: 800,
                    color: timeLeft < 300 ? 'var(--danger)' : 'var(--amber)',
                    fontFamily: 'monospace',
                }}>
                    ⏱ {fmt(timeLeft)}
                </div>
                <button className="btn btn-danger" style={{ marginLeft: 24 }} onClick={() => handleSubmit()} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit Exam'}
                </button>
            </header>

            <div className="cbt-main">
                {/* Question panel */}
                <div className="cbt-question-panel">
                    {q && (
                        <>
                            <div style={{ marginBottom: 24 }}>
                                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        Question {current + 1} of {questions.length}
                                    </span>
                                    <button
                                        className={`btn btn-sm ${flagged.has(q.id) ? 'btn-amber' : 'btn-secondary'}`}
                                        onClick={() => { const f = new Set(flagged); f.has(q.id) ? f.delete(q.id) : f.add(q.id); setFlagged(f); }}
                                    >
                                        <Flag size={14} /> {flagged.has(q.id) ? 'Flagged' : 'Flag'}
                                    </button>
                                </div>
                                <div style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)', padding: 24, marginBottom: 24, fontSize: '1.05rem', lineHeight: 1.7
                                }}>
                                    {q.questionText}
                                </div>
                            </div>

                            {['A', 'B', 'C', 'D'].map(opt => (
                                <button key={opt} className={`cbt-option ${answers[q.id] === opt ? 'selected' : ''}`}
                                    onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem',
                                        background: answers[q.id] === opt ? 'var(--accent)' : 'var(--bg-secondary)',
                                        color: answers[q.id] === opt ? '#000' : 'var(--text-secondary)',
                                    }}>{opt}</div>
                                    <span>{q[`option${opt}`]}</span>
                                </button>
                            ))}

                            <div className="flex items-center justify-between" style={{ marginTop: 32 }}>
                                <button className="btn btn-secondary" onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}>
                                    <ChevronLeft size={16} /> Previous
                                </button>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {Object.keys(answers).length} / {questions.length} answered
                                </span>
                                <button className="btn btn-primary" onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}>
                                    Next <ChevronRight size={16} />
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Question navigator */}
                <div className="cbt-nav-panel">
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>NAVIGATOR</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                        {questions.map((q, idx) => (
                            <button key={q.id}
                                className={`cbt-nav-btn ${idx === current ? 'current' : flagged.has(q.id) ? 'flagged' : answers[q.id] ? 'answered' : ''}`}
                                onClick={() => setCurrent(idx)}>
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { cls: 'answered', label: 'Answered' },
                            { cls: 'flagged', label: 'Flagged' },
                            { cls: '', label: 'Unanswered' },
                        ].map(({ cls, label }) => (
                            <div key={label} className="flex items-center gap-8" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                <div className={`cbt-nav-btn ${cls}`} style={{ width: 22, height: 22, pointerEvents: 'none' }} />
                                {label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
