import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, Monitor, BookOpen, Settings2 } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const emptyQ = { courseId: '', questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A', explanation: '', marks: 1, difficulty: 'MEDIUM' };
const emptyE = { courseId: '', semesterId: '', title: '', instructions: '', durationMinutes: 60, totalMarks: 100, passMark: 50, startWindow: '', endWindow: '', allowReview: true };

export default function CbtAdminPage() {
    const toast = useToast();
    const [tab, setTab] = useState('exams');
    const [courses, setCourses] = useState([]);
    const [sessions, setSessions] = useState([]);

    // Questions
    const [questions, setQuestions] = useState([]);
    const [qModal, setQModal] = useState(null);
    const [qForm, setQForm] = useState(emptyQ);
    const [qCourse, setQCourse] = useState('');

    // Exams
    const [exams, setExams] = useState([]);
    const [eModal, setEModal] = useState(null);
    const [eForm, setEForm] = useState(emptyE);

    // Assign questions
    const [assignModal, setAssignModal] = useState(null); // exam
    const [availQ, setAvailQ] = useState([]);
    const [selected, setSelected] = useState(new Set());

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [cRes, sRes, qRes, eRes] = await Promise.all([
                    api.get('/courses'),
                    api.get('/sessions'),
                    api.get('/cbt/questions'),
                    api.get('/cbt/exams'),
                ]);
                setCourses(cRes.data.data || []);
                setSessions(sRes.data || []);
                setQuestions(qRes.data.data || []);
                setExams(eRes.data.data || []);
            } catch { }
        })();
    }, []);

    const loadQuestions = async () => {
        try {
            const { data } = await api.get('/cbt/questions', { params: { courseId: qCourse || undefined } });
            setQuestions(data.data || []);
        } catch { }
    };

    useEffect(() => { loadQuestions(); }, [qCourse]);

    const handleSaveQ = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (qModal === 'add') { await api.post('/cbt/questions', qForm); toast('Question added'); }
            else { await api.put(`/cbt/questions/${qForm._id}`, qForm); toast('Question updated'); }
            setQModal(null); loadQuestions();
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
        setSaving(false);
    };

    const handleDeleteQ = async (id) => {
        if (!confirm('Delete this question?')) return;
        try { await api.delete(`/cbt/questions/${id}`); toast('Deleted'); loadQuestions(); }
        catch { toast('Delete failed', 'error'); }
    };

    const handleSaveE = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (eModal === 'add') { await api.post('/cbt/exams', eForm); toast('Exam created'); }
            else { await api.put(`/cbt/exams/${eForm._id}`, eForm); toast('Exam updated'); }
            setEModal(null);
            const { data } = await api.get('/cbt/exams');
            setExams(data.data || []);
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
        setSaving(false);
    };

    const openAssign = async (exam) => {
        try {
            const { data } = await api.get('/cbt/questions', { params: { courseId: exam.courseId } });
            setAvailQ(data.data || []);
            const { data: ed } = await api.get(`/cbt/exams/${exam.id}`);
            const current = new Set((ed.questions || []).map(q => q.questionId));
            setSelected(current);
            setAssignModal(exam);
        } catch { toast('Could not load questions', 'error'); }
    };

    const handleAssign = async () => {
        try {
            await api.post(`/cbt/exams/${assignModal.id}/questions`, { questionIds: Array.from(selected) });
            toast('Questions assigned');
            setAssignModal(null);
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
    };

    const togglePublish = async (exam) => {
        try {
            await api.put(`/cbt/exams/${exam.id}`, { isPublished: !exam.isPublished });
            toast(exam.isPublished ? 'Exam unpublished' : 'Exam published');
            const { data } = await api.get('/cbt/exams');
            setExams(data.data || []);
        } catch { toast('Failed', 'error'); }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">CBT Administration</h1>
                    <p className="page-subtitle">Manage question bank and computer-based tests</p>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab-btn ${tab === 'exams' ? 'active' : ''}`} onClick={() => setTab('exams')}>Exams ({exams.length})</button>
                <button className={`tab-btn ${tab === 'questions' ? 'active' : ''}`} onClick={() => setTab('questions')}>Question Bank ({questions.length})</button>
            </div>

            {/* ── Exams ── */}
            {tab === 'exams' && (
                <>
                    <div style={{ marginBottom: 16 }}>
                        <button className="btn btn-primary" onClick={() => { setEForm(emptyE); setEModal('add'); }}>
                            <Plus size={16} /> Create Exam
                        </button>
                    </div>
                    {exams.length === 0 ? <div className="empty"><Monitor size={48} /><p>No CBT exams yet</p></div> : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Title</th><th>Course</th><th>Duration</th><th>Questions</th><th>Published</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {exams.map(ex => (
                                        <tr key={ex.id}>
                                            <td style={{ fontWeight: 600 }}>{ex.title}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{ex.course?.code}</td>
                                            <td>{ex.durationMinutes} min</td>
                                            <td style={{ textAlign: 'center' }}>{ex.questions?.length ?? 0}</td>
                                            <td>
                                                <span className={`badge ${ex.isPublished ? 'badge-green' : 'badge-muted'}`}>
                                                    {ex.isPublished ? 'Published' : 'Draft'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex gap-8">
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openAssign(ex)}><Settings2 size={14} /> Questions</button>
                                                    <button className={`btn btn-sm ${ex.isPublished ? 'btn-danger' : 'btn-primary'}`} onClick={() => togglePublish(ex)}>
                                                        {ex.isPublished ? 'Unpublish' : 'Publish'}
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setEForm({ ...ex, startWindow: ex.startWindow?.substring(0, 16) || '', endWindow: ex.endWindow?.substring(0, 16) || '', _id: ex.id }); setEModal('edit'); }}><Edit2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── Questions ── */}
            {tab === 'questions' && (
                <>
                    <div className="search-bar">
                        <select value={qCourse} onChange={e => setQCourse(e.target.value)} style={{ width: 200 }}>
                            <option value="">All Courses</option>
                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                        </select>
                        <button className="btn btn-primary" onClick={() => { setQForm(emptyQ); setQModal('add'); }}>
                            <Plus size={16} /> Add Question
                        </button>
                    </div>
                    {questions.length === 0 ? <div className="empty"><BookOpen size={48} /><p>No questions yet</p></div> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {questions.map((q, idx) => (
                                <div key={q.id} className="card card-sm">
                                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Q{idx + 1}</span>
                                        <div className="flex gap-8">
                                            <span className="badge badge-muted">{q.course?.code}</span>
                                            <span className={`badge ${q.difficulty === 'EASY' ? 'badge-green' : q.difficulty === 'HARD' ? 'badge-red' : 'badge-amber'}`}>{q.difficulty}</span>
                                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setQForm({ ...q, _id: q.id }); setQModal('edit'); }}><Edit2 size={14} /></button>
                                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteQ(q.id)}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                    <p style={{ marginBottom: 10, fontWeight: 500 }}>{q.questionText}</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                        {['A', 'B', 'C', 'D'].map(opt => (
                                            <div key={opt} style={{
                                                padding: '6px 10px', borderRadius: 6, fontSize: '0.82rem',
                                                background: q.correctOption === opt ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                                                border: `1px solid ${q.correctOption === opt ? 'var(--accent)' : 'var(--border)'}`,
                                                color: q.correctOption === opt ? 'var(--accent)' : 'var(--text-secondary)',
                                            }}>
                                                <strong>{opt}.</strong> {q[`option${opt}`]}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Exam Modal */}
            {eModal && (
                <div className="modal-backdrop" onClick={() => setEModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{eModal === 'add' ? 'Create CBT Exam' : 'Edit Exam'}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSaveE}>
                            <div className="modal-body">
                                <div className="form-group"><label>Title *</label><input required value={eForm.title} onChange={e => setEForm(f => ({ ...f, title: e.target.value }))} /></div>
                                <div className="form-row">
                                    <div className="form-group"><label>Course *</label>
                                        <select required value={eForm.courseId} onChange={e => setEForm(f => ({ ...f, courseId: e.target.value }))}>
                                            <option value="">Select…</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Semester *</label>
                                        <select required value={eForm.semesterId} onChange={e => setEForm(f => ({ ...f, semesterId: e.target.value }))}>
                                            <option value="">Select…</option>
                                            {sessions.map(s => <option key={s.id} value={s.id}>{s.session?.title} — {s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Duration (min)</label><input type="number" min={5} value={eForm.durationMinutes} onChange={e => setEForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} /></div>
                                    <div className="form-group"><label>Total Marks</label><input type="number" min={1} value={eForm.totalMarks} onChange={e => setEForm(f => ({ ...f, totalMarks: Number(e.target.value) }))} /></div>
                                    <div className="form-group"><label>Pass Mark</label><input type="number" min={1} value={eForm.passMark} onChange={e => setEForm(f => ({ ...f, passMark: Number(e.target.value) }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Start Window</label><input type="datetime-local" value={eForm.startWindow} onChange={e => setEForm(f => ({ ...f, startWindow: e.target.value }))} /></div>
                                    <div className="form-group"><label>End Window</label><input type="datetime-local" value={eForm.endWindow} onChange={e => setEForm(f => ({ ...f, endWindow: e.target.value }))} /></div>
                                </div>
                                <div className="form-group"><label>Instructions</label><textarea value={eForm.instructions} onChange={e => setEForm(f => ({ ...f, instructions: e.target.value }))} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setEModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : eModal === 'add' ? 'Create' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Question Modal */}
            {qModal && (
                <div className="modal-backdrop" onClick={() => setQModal(null)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{qModal === 'add' ? 'Add Question' : 'Edit Question'}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setQModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSaveQ}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group"><label>Course *</label>
                                        <select required value={qForm.courseId} onChange={e => setQForm(f => ({ ...f, courseId: e.target.value }))}>
                                            <option value="">Select…</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Difficulty</label>
                                        <select value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: e.target.value }))}>
                                            <option>EASY</option><option>MEDIUM</option><option>HARD</option>
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Marks</label>
                                        <input type="number" min={1} step={0.5} value={qForm.marks} onChange={e => setQForm(f => ({ ...f, marks: Number(e.target.value) }))} />
                                    </div>
                                </div>
                                <div className="form-group"><label>Question *</label><textarea required value={qForm.questionText} onChange={e => setQForm(f => ({ ...f, questionText: e.target.value }))} /></div>
                                {['A', 'B', 'C', 'D'].map(opt => (
                                    <div className="form-group" key={opt}>
                                        <label>Option {opt} *</label>
                                        <input required value={qForm[`option${opt}`]} onChange={e => setQForm(f => ({ ...f, [`option${opt}`]: e.target.value }))} />
                                    </div>
                                ))}
                                <div className="form-group"><label>Correct Answer *</label>
                                    <select required value={qForm.correctOption} onChange={e => setQForm(f => ({ ...f, correctOption: e.target.value }))}>
                                        <option>A</option><option>B</option><option>C</option><option>D</option>
                                    </select>
                                </div>
                                <div className="form-group"><label>Explanation</label><textarea value={qForm.explanation} onChange={e => setQForm(f => ({ ...f, explanation: e.target.value }))} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setQModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : qModal === 'add' ? 'Add Question' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Questions Modal */}
            {assignModal && (
                <div className="modal-backdrop" onClick={() => setAssignModal(null)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Assign Questions — {assignModal.title}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setAssignModal(null)}><X size={16} /></button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: 460, overflowY: 'auto', padding: '12px 24px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                {selected.size} of {availQ.length} questions selected
                            </p>
                            {availQ.map((q, idx) => (
                                <label key={q.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={selected.has(q.id)}
                                        onChange={() => { const s = new Set(selected); s.has(q.id) ? s.delete(q.id) : s.add(q.id); setSelected(s); }}
                                        style={{ width: 16, height: 16, marginTop: 2 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Q{idx + 1}: {q.questionText.substring(0, 80)}…</div>
                                        <span className={`badge ${q.difficulty === 'EASY' ? 'badge-green' : q.difficulty === 'HARD' ? 'badge-red' : 'badge-amber'}`} style={{ marginTop: 4 }}>{q.difficulty}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setAssignModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAssign}>Save Assignment</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
