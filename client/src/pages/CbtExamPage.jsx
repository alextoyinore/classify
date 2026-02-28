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
    const [answers, setAnswers] = useState({}); // Stores finalized answers (permanent)
    const [skipped, setSkipped] = useState(new Set());
    const [flagged, setFlagged] = useState(new Set());
    const [current, setCurrent] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [phase, setPhase] = useState('list'); // 'list' | 'exam' | 'submitted'
    const [submitting, setSubmitting] = useState(false);
    const [savingAnsw, setSavingAnsw] = useState(false);
    const timerRef = useRef(null);
    const isNavigatingAway = useRef(false);

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
            const att = data.attempt;
            const qs = data.questions || [];

            // Resume Logic: Calculate actual time left based on server start time
            const started = new Date(att.startedAt).getTime();
            const now = new Date().getTime();
            const elapsed = Math.floor((now - started) / 1000);
            const total = (data.exam?.durationMinutes || exam.durationMinutes) * 60;
            const remaining = Math.max(0, total - elapsed);

            setAttempt(att);
            setQuestions(qs);
            setTimeLeft(remaining);
            setPhase('exam');

            // Load existing answers if resuming
            if (data.savedAnswers) {
                const ansObj = {};
                data.savedAnswers.forEach(a => {
                    if (a.selected) ansObj[a.questionId] = a.selected;
                });
                setAnswers(ansObj);
            }

            setFlagged(new Set());
            setSkipped(new Set());
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
                if (t <= 1) {
                    clearInterval(timerRef.current);
                    if (!isNavigatingAway.current) handleSubmit(true);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [phase]);

    const handleSelectOption = async (questionId, opt) => {
        if (answers[questionId]) return; // Permanent: Cannot change once answered
        if (!confirm(`Finalize Answer: "${opt}"? Once selected, you cannot change this answer.`)) return;

        setSavingAnsw(true);
        try {
            await api.post(`/cbt/attempts/${attempt.id}/save-answer`, { questionId, selected: opt });
            setAnswers(prev => ({ ...prev, [questionId]: opt }));
            setSkipped(prev => {
                const next = new Set(prev);
                next.delete(questionId);
                return next;
            });
            // Auto-advance if not the last question
            if (current < questions.length - 1) setCurrent(c => c + 1);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to save answer', 'error');
        }
        setSavingAnsw(false);
    };

    const handleSkip = () => {
        if (answers[questions[current].id]) return; // Cannot skip an answered question
        setSkipped(prev => new Set(prev).add(questions[current].id));
        if (current < questions.length - 1) setCurrent(c => c + 1);
    };

    const handleSubmit = async (auto = false) => {
        if (!auto) {
            const unanswered = questions.length - Object.keys(answers).length;
            const msg = unanswered > 0
                ? `You have ${unanswered} unanswered questions. Submit anyway?`
                : 'Submit exam? You cannot change answers after submitting.';
            if (!confirm(msg)) return;
        }

        clearInterval(timerRef.current);
        setSubmitting(true);
        try {
            await api.post(`/cbt/attempts/${attempt.id}/submit`);
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
                                    {ex.isSessionActive ? (
                                        <span className="badge badge-green">Session Active</span>
                                    ) : (
                                        <span className="badge badge-red">Session Not Started</span>
                                    )}
                                </div>
                                {ex.instructions && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{ex.instructions}</p>}
                                <button
                                    className={`btn ${ex.myAttempt && !ex.myAttempt.isCompleted ? 'btn-amber' : 'btn-primary'} w-full`}
                                    style={{ justifyContent: 'center', opacity: ex.isSessionActive ? 1 : 0.6 }}
                                    onClick={() => ex.isSessionActive && startExam(ex)}
                                    disabled={!ex.isSessionActive || (ex.myAttempt?.isCompleted)}
                                >
                                    {!ex.isSessionActive ? 'Wait for Session'
                                        : ex.myAttempt?.isCompleted ? 'Exam Completed'
                                            : ex.myAttempt ? 'Resume Exam'
                                                : 'Start Exam'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="cbt-shell">
            <header className="topbar">
                <div className="topbar-brand"><GraduationCap size={22} /> {attempt?.exam?.title || 'Examination'}</div>
                <div className="topbar-spacer" />
                <div style={{
                    fontSize: '1.4rem', fontWeight: 800,
                    color: timeLeft < 300 ? 'var(--danger)' : 'var(--accent)',
                    fontFamily: 'monospace',
                    background: 'var(--bg-secondary)',
                    padding: '4px 20px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                }}>
                    <span style={{ fontSize: '1rem', opacity: 0.6 }}>Time Left</span>
                    {fmt(timeLeft)}
                </div>
                <div className="flex gap-12" style={{ marginLeft: 32 }}>
                    <button className="btn btn-secondary" onClick={() => {
                        isNavigatingAway.current = true;
                        navigate('/cbt/exam');
                    }} title="Save progress and return to dashboard">
                        Pause & Exit
                    </button>
                    <button className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleSubmit()} disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Submit Exam'}
                    </button>
                </div>
            </header>

            <div className="cbt-main">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Persistent Instructions */}
                    <div className="card" style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', padding: 16 }}>
                        <h4 style={{ color: 'var(--accent-dark)', marginBottom: 8, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <GraduationCap size={16} /> How it works:
                        </h4>
                        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                            <li><b>Answers are Final:</b> Once you select an option and confirm, you <b>cannot</b> change it.</li>
                            <li><b>Progress Saved:</b> Your progress is saved automatically. You can logout and return within the time window.</li>
                            <li><b>Skipping:</b> Use the "Skip" button to go back to a question later. Skipped questions show as <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Amber</span> in the right panel.</li>
                            <li><b>Auto-Submit:</b> The exam will submit automatically when the timer reaches zero.</li>
                        </ul>
                    </div>

                    <div className="cbt-question-panel">
                        {q && (
                            <>
                                <div style={{ marginBottom: 24 }}>
                                    <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                                        <div className="flex items-center gap-12">
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                Question {current + 1} of {questions.length}
                                            </span>
                                            {answers[q.id] && <span className="badge badge-green">Finalized</span>}
                                            {skipped.has(q.id) && !answers[q.id] && <span className="badge badge-amber">Skipped</span>}
                                        </div>
                                        <button
                                            className={`btn btn-sm ${flagged.has(q.id) ? 'btn-amber' : 'btn-secondary'}`}
                                            onClick={() => { const f = new Set(flagged); f.has(q.id) ? f.delete(q.id) : f.add(q.id); setFlagged(f); }}
                                        >
                                            <Flag size={14} /> {flagged.has(q.id) ? 'Flagged' : 'Flag'}
                                        </button>
                                    </div>
                                    <div style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 32,
                                        marginBottom: 32,
                                        fontSize: '1.2rem',
                                        fontWeight: 500,
                                        lineHeight: 1.6,
                                        opacity: answers[q.id] ? 0.9 : 1,
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: 'var(--accent)' }} />
                                        {q.questionText}
                                    </div>
                                </div>

                                {['A', 'B', 'C', 'D'].map(opt => (
                                    <button key={opt}
                                        className={`cbt-option ${answers[q.id] === opt ? 'selected' : ''} ${answers[q.id] && answers[q.id] !== opt ? 'disabled' : ''}`}
                                        disabled={!!answers[q.id] || savingAnsw}
                                        onClick={() => handleSelectOption(q.id, opt)}>
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
                                    <div className="flex gap-12">
                                        {!answers[q.id] && (
                                            <button className="btn btn-amber" onClick={handleSkip}>
                                                Skip Question
                                            </button>
                                        )}
                                        <button className="btn btn-primary" onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1}>
                                            Next <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="cbt-nav-panel">
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>QUESTION NAVIGATOR</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                        {questions.map((qu, idx) => (
                            <button key={qu.id}
                                className={`cbt-nav-btn ${idx === current ? 'current' : flagged.has(qu.id) ? 'flagged' : answers[qu.id] ? 'answered' : skipped.has(qu.id) ? 'skipped' : ''}`}
                                onClick={() => setCurrent(idx)}>
                                {idx + 1}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            { cls: 'answered', label: `Finalized (${Object.keys(answers).length})` },
                            { cls: 'skipped', label: `Skipped (${skipped.size})` },
                            { cls: 'flagged', label: 'Flagged' },
                            { cls: '', label: 'Remaining' },
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
