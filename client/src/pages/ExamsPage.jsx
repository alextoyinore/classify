import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Edit2, Trash2, FileText, Monitor, Settings2, BarChart2, Check, Calendar } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const empty = {
    title: '', courseId: '', semesterId: '', type: 'WRITTEN', category: 'TEST',
    examDate: '', totalMarks: 100, passMark: 40, durationMinutes: 60,
    instructions: '', topicIds: [], numQuestions: 0,
    startWindow: '', endWindow: '', allowReview: true
};

export default function ExamsPage() {
    const toast = useToast();
    const navigate = useNavigate();
    const [tab, setTab] = useState('list');
    const [exams, setExams] = useState([]);
    const [courses, setCourses] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(empty);
    const [currentSemesterId, setCurrentSemesterId] = useState('');
    const [saving, setSaving] = useState(false);
    const [scoreModal, setScoreModal] = useState(null); // { exam, students }
    const [scoreEntries, setScoreEntries] = useState({});
    const [courseTopics, setCourseTopics] = useState([]);

    // Question Assignment for CBT
    const [assignModal, setAssignModal] = useState(null); // exam object
    const [availQ, setAvailQ] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [assignShowAll, setAssignShowAll] = useState(false);
    const [loadingAssign, setLoadingAssign] = useState(false);

    const loadTopics = async (cid) => {
        if (!cid) return;
        try {
            const { data } = await api.get(`/courses/${cid}`);
            setCourseTopics(data.topics || []);
        } catch { }
    };

    useEffect(() => {
        if (form.courseId) loadTopics(form.courseId);
        else setCourseTopics([]);
    }, [form.courseId]);

    // Auto-generate title for CBT
    useEffect(() => {
        if (form.type !== 'CBT' || !form.courseId || !form.semesterId) return;
        const course = courses.find(c => c.id === form.courseId);
        const semester = sessions.find(s => s.id === form.semesterId);
        if (course && semester) {
            const catLabel = form.category || 'TEST';
            const sessionTitle = semester.session?.title || '';
            const newTitle = `CBT ${catLabel}: ${course.code} - ${semester.name} ${sessionTitle ? `(${sessionTitle})` : ''}`;
            if (form.title !== newTitle) {
                setForm(f => ({ ...f, title: newTitle }));
            }
        }
    }, [form.type, form.category, form.courseId, form.semesterId, courses, sessions]);

    const load = async () => {
        setLoading(true);
        try {
            const [eRes, cRes, sRes, curRes] = await Promise.all([
                api.get('/exams'),
                api.get('/courses'),
                api.get('/sessions'),
                api.get('/sessions/current')
            ]);
            setExams(eRes.data.data || []);
            setCourses(cRes.data.data || []);
            setSessions(sRes.data || []);
            if (curRes.data) {
                setCurrentSemesterId(curRes.data.id);
                setForm(f => ({ ...f, semesterId: curRes.data.id }));
            }
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openAdd = () => { setForm({ ...empty, semesterId: currentSemesterId }); setModal('add'); };
    const openEdit = (ex) => {
        setForm({
            ...empty,
            title: ex.title, courseId: ex.courseId, semesterId: ex.semesterId, type: ex.isCbt ? 'CBT' : (ex.type || 'WRITTEN'),
            examDate: ex.examDate ? ex.examDate.substring(0, 10) : '', totalMarks: ex.totalMarks, id: ex.id,
            topicIds: ex.topicIds || [], numQuestions: ex.numQuestions || 0,
            isCbt: ex.isCbt,
            category: ex.category || 'EXAM',
            instructions: ex.instructions || '',
            passMark: ex.passMark || 40,
            durationMinutes: ex.durationMinutes || 60,
            startWindow: ex.startWindow ? ex.startWindow.substring(0, 16) : '',
            endWindow: ex.endWindow ? ex.endWindow.substring(0, 16) : '',
            allowReview: ex.allowReview ?? true,
            isPublished: ex.isPublished
        });
        setModal('edit');
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            const payload = { ...form, numQuestions: Number(form.numQuestions || 0) };
            if (modal === 'add') {
                await api.post('/exams', payload);
                toast('Exam created');
            } else {
                const endpoint = form.isCbt ? `/cbt/exams/${form.id}` : `/exams/${form.id}`;
                await api.put(endpoint, payload);
                toast('Exam updated');
            }
            setModal(null); load();
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
        setSaving(false);
    };

    const handleDelete = async (id, title, isCbt = false) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try {
            const endpoint = isCbt ? `/cbt/exams/${id}` : `/exams/${id}`;
            await api.delete(endpoint);
            toast('Exam deleted');
            load();
        } catch (err) { toast(err.response?.data?.error || 'Delete failed', 'error'); }
    };

    const openScores = async (exam) => {
        try {
            const { data } = await api.get(`/courses/${exam.courseId}/students`);
            const students = data || [];
            const init = {};
            students.forEach(e => { init[e.student?.id] = ''; });
            setScoreEntries(init);
            setScoreModal({ exam, students });
        } catch { toast('Could not load students', 'error'); }
    };

    const handleSubmitScores = async (e) => {
        e.preventDefault();
        const scores = Object.entries(scoreEntries)
            .filter(([, v]) => v !== '')
            .map(([studentId, score]) => ({ studentId, score: parseFloat(score) }));
        try {
            await api.post(`/exams/${scoreModal.exam.id}/scores`, { scores });
            toast(`Scores saved for ${scores.length} students`);
            setScoreModal(null);
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
    };

    const openAssign = async (exam, showAll = false) => {
        setLoadingAssign(true);
        setAssignShowAll(showAll);
        try {
            // Get exam details to get the current assignments and pooling
            const { data: ed } = await api.get(`/cbt/exams/${exam.id}`);
            const topicIds = ed.topicIds || [];

            const params = { courseId: exam.courseId, limit: 100 };
            if (!showAll && topicIds.length > 0) {
                params.topicIds = topicIds;
            }

            const { data } = await api.get('/cbt/questions', { params });
            setAvailQ(data.data || []);
            const current = new Set((ed.questions || []).map(q => q.questionId));
            setSelected(current);
            setAssignModal(ed);
        } catch { toast('Could not load questions', 'error'); }
        setLoadingAssign(false);
    };

    const handleAssign = async () => {
        try {
            await api.post(`/cbt/exams/${assignModal.id}/questions`, { questionIds: Array.from(selected) });
            toast('Questions assigned successfully');
            setAssignModal(null);
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Management Center</h1>
                    <p className="page-subtitle">Unified dashboard for exams, banks and results</p>
                </div>
                <button className="btn btn-primary" onClick={() => {
                    setForm({ ...empty, type: 'CBT', semesterId: currentSemesterId });
                    setModal('add');
                }}>
                    <Plus size={16} /> Schedule Exam
                </button>
            </div>

            <div className="flex gap-24 mb-24 border-b" style={{ borderColor: 'var(--border)' }}>
                <button
                    className={`pb-12 px-8 font-bold transition-all ${tab === 'list' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-secondary'}`}
                    onClick={() => setTab('list')}
                >
                    Schedules
                </button>
                <button
                    className={`pb-12 px-8 font-bold transition-all ${tab === 'bank' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-secondary'}`}
                    onClick={() => navigate('/cbt/admin')}
                >
                    Question Library
                </button>
            </div>

            {tab === 'list' && (
                <>
                    {loading ? <div className="loading-wrap"><div className="spinner" /></div> :
                        exams.length === 0 ? <div className="empty"><FileText size={48} /><p>No exams scheduled</p></div> : (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Title</th><th>Course</th><th>Mode</th><th>Status / Date</th><th>Total Marks</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {exams.map(ex => (
                                            <tr key={`${ex.isCbt ? 'cbt' : 'wr'}-${ex.id}`}>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{ex.title}</div>
                                                    {ex.isCbt && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Digital Exam</div>}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{ex.course?.code}</td>
                                                <td>
                                                    <span className={`badge ${ex.isCbt ? 'badge-blue' : 'badge-muted'}`}>
                                                        {ex.isCbt ? <Monitor size={10} style={{ marginRight: 4 }} /> : <FileText size={10} style={{ marginRight: 4 }} />}
                                                        {ex.type}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text-secondary)' }}>
                                                    {ex.isCbt ? (
                                                        <span className={`badge ${ex.isPublished ? 'badge-green' : 'badge-muted'}`}>
                                                            {ex.isPublished ? 'Published' : 'Draft'}
                                                        </span>
                                                    ) : (
                                                        <span>{ex.examDate ? new Date(ex.examDate).toLocaleDateString() : '—'}</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>{ex.totalMarks}</td>
                                                <td>
                                                    <div className="flex gap-8">
                                                        {ex.isCbt ? (
                                                            <>
                                                                <button className="btn btn-secondary btn-sm" onClick={() => openAssign(ex)}>
                                                                    <Settings2 size={14} /> Questions
                                                                </button>
                                                                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(ex)}><Edit2 size={14} /></button>
                                                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(ex.id, ex.title, ex.isCbt)}><Trash2 size={14} /></button>
                                                                {ex.isPublished && (
                                                                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/exams/${ex.id}/analytics`)}>
                                                                        <BarChart2 size={14} /> Analytics
                                                                    </button>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <>
                                                                <button className="btn btn-amber btn-sm" onClick={() => openScores(ex)}>Scores</button>
                                                                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(ex)}><Edit2 size={14} /></button>
                                                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(ex.id, ex.title)}><Trash2 size={14} /></button>
                                                            </>
                                                        )}
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

            {/* Add/Edit Modal */}
            {modal && (
                <div className="modal-backdrop" onClick={() => setModal(null)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{modal === 'add' ? 'Schedule Exam' : 'Edit Exam'}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group"><label>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                                <div className="form-row">
                                    <div className="form-group"><label>Course *</label>
                                        <select required value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}>
                                            <option value="">Select course…</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Semester *</label>
                                        <select required value={form.semesterId} onChange={e => setForm(f => ({ ...f, semesterId: e.target.value }))}>
                                            <option value="">Select semester…</option>
                                            {sessions.map(s => <option key={s.id} value={s.id}>{s.session?.title} — {s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Mode / Type</label>
                                        <div className="flex gap-8">
                                            {[
                                                { id: 'WRITTEN', label: 'Written' },
                                                { id: 'CBT', label: 'Digital/CBT' },
                                                { id: 'PRACTICAL', label: 'Practical' }
                                            ].map(t => (
                                                <button key={t.id} type="button"
                                                    className={`btn btn-sm ${form.type === t.id ? 'btn-primary' : 'btn-secondary'}`}
                                                    style={{ flex: 1 }}
                                                    onClick={() => setForm(f => ({ ...f, type: t.id }))}>
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-group"><label>Total Marks</label>
                                        <input type="number" min={1} value={form.totalMarks} onChange={e => setForm(f => ({ ...f, totalMarks: Number(e.target.value) }))} />
                                    </div>
                                </div>
                                {form.type !== 'CBT' ? (
                                    <div className="form-group">
                                        <label>Exam Date</label>
                                        <input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>The specific day this exam takes place.</p>
                                    </div>
                                ) : (
                                    <div className="card" style={{ background: 'var(--accent-dim)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--accent-light)', marginBottom: 16 }}>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <Calendar size={18} color="var(--accent)" />
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--accent-dark)', fontWeight: 600 }}>
                                                CBT Window mode is active. Use the <b>Start</b> and <b>End Windows</b> below to control student access.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {form.type === 'CBT' && (
                                    <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: 16, marginTop: 16 }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 16, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Monitor size={18} /> Digital Exam Configuration
                                        </h3>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Exam Category</label>
                                                <div className="flex gap-12">
                                                    {['TEST', 'EXAM'].map(c => (
                                                        <button key={c} type="button"
                                                            className={`btn btn-sm ${form.category === c ? 'btn-primary' : 'btn-secondary'}`}
                                                            style={{ flex: 1 }}
                                                            onClick={() => setForm(f => ({ ...f, category: c }))}>
                                                            {c}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>Duration (Minutes)</label>
                                                <input type="number" min={1} value={form.durationMinutes} onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))} />
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Pass Mark (%)</label>
                                                <input type="number" min={1} max={100} value={form.passMark} onChange={e => setForm(f => ({ ...f, passMark: Number(e.target.value) }))} />
                                            </div>
                                            <div className="form-group">
                                                <label>Availability</label>
                                                <div className="flex items-center gap-12 mt-8">
                                                    <label className="flex items-center gap-6 cursor-pointer">
                                                        <input type="checkbox" checked={form.allowReview} onChange={e => setForm(f => ({ ...f, allowReview: e.target.checked }))} />
                                                        <span style={{ fontSize: '0.82rem' }}>Allow Review</span>
                                                    </label>
                                                    {modal === 'edit' && (
                                                        <label className="flex items-center gap-6 cursor-pointer">
                                                            <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
                                                            <span style={{ fontSize: '0.82rem', color: 'var(--green)', fontWeight: 700 }}>Published</span>
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Start Window (Optional)</label>
                                                <input type="datetime-local" value={form.startWindow} onChange={e => setForm(f => ({ ...f, startWindow: e.target.value }))} />
                                            </div>
                                            <div className="form-group">
                                                <label>End Window (Optional)</label>
                                                <input type="datetime-local" value={form.endWindow} onChange={e => setForm(f => ({ ...f, endWindow: e.target.value }))} />
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label>Number of Random Questions</label>
                                                <input
                                                    type="number" min={1}
                                                    value={form.numQuestions || ''}
                                                    onChange={e => setForm(f => ({ ...f, numQuestions: e.target.value }))}
                                                    placeholder="e.g. 50"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Points Per Question</label>
                                                <div style={{ padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent)' }}>
                                                    {form.numQuestions > 0 ? (form.totalMarks / form.numQuestions).toFixed(2) : '0.00'} pts
                                                </div>
                                            </div>
                                        </div>

                                        <div className="divider my-16" style={{ borderTop: '1px dashed var(--border)' }} />

                                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>Question Pooling (Topics)</h3>
                                        <div className="form-group">
                                            <div className="flex items-center justify-between mb-8">
                                                <label style={{ margin: 0 }}>Select Topics</label>
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                                                    const all = courseTopics.map(t => t.id);
                                                    setForm(f => ({ ...f, topicIds: f.topicIds.length === all.length ? [] : all }));
                                                }}>
                                                    {form.topicIds.length === courseTopics.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                                                {courseTopics.length > 0 ? courseTopics.map(topic => {
                                                    const selected = form.topicIds?.includes(topic.id);
                                                    return (
                                                        <label key={topic.id} style={{
                                                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                                            background: selected ? 'var(--accent-dim)' : 'var(--bg-card)',
                                                            color: selected ? 'var(--accent-dark)' : 'var(--text-secondary)',
                                                            padding: '8px 12px', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s'
                                                        }}>
                                                            <input type="checkbox" style={{ display: 'none' }} checked={selected}
                                                                onChange={() => {
                                                                    const next = selected ? form.topicIds.filter(id => id !== topic.id) : [...form.topicIds, topic.id];
                                                                    setForm(f => ({ ...f, topicIds: next }));
                                                                }}
                                                            />
                                                            {selected && <Check size={14} />}
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.title}</span>
                                                        </label>
                                                    );
                                                }) : (
                                                    <div style={{ gridColumn: '1/-1', padding: '20px', textAlign: 'center', background: 'var(--bg-inset)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                        {form.courseId ? 'No topics found for this course. Please add topics in the Course Curriculum.' : 'Select a course above to see available topics.'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="form-group mt-16">
                                            <label>Instructions for Students</label>
                                            <textarea rows={3} placeholder="e.g. Ensure your webcam is on. No calculators allowed..." value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Score Entry Modal */}
            {scoreModal && (
                <div className="modal-backdrop" onClick={() => setScoreModal(null)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Enter Scores — {scoreModal.exam.title}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setScoreModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSubmitScores}>
                            <div className="modal-body" style={{ padding: 0 }}>
                                <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
                                    <table>
                                        <thead><tr><th>Student</th><th>Matric No.</th><th>Score (/{scoreModal.exam.totalMarks})</th></tr></thead>
                                        <tbody>
                                            {scoreModal.students.map(e => (
                                                <tr key={e.student?.id}>
                                                    <td style={{ fontWeight: 600 }}>{e.student?.firstName} {e.student?.lastName}</td>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{e.student?.matricNumber}</td>
                                                    <td>
                                                        <input type="number" min={0} max={scoreModal.exam.totalMarks} step={0.5}
                                                            style={{ width: 100 }}
                                                            value={scoreEntries[e.student?.id] ?? ''}
                                                            onChange={ev => setScoreEntries(s => ({ ...s, [e.student?.id]: ev.target.value }))} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setScoreModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Scores</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Score Entry Modal Snippet preserved ... */}

            {/* Question Assignment Modal */}
            {assignModal && (
                <div className="modal-backdrop" onClick={() => setAssignModal(null)}>
                    <div className="modal" style={{ maxWidth: '85%', width: 800 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <span className="modal-title">Manual Question Selection: {assignModal.title}</span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                    {assignShowAll ? 'Showing all questions for course' : `Filtering by selected topic(s)`}
                                </div>
                            </div>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setAssignModal(null)}><X size={16} /></button>
                        </div>
                        <div className="modal-body" style={{ background: 'var(--bg-secondary)', padding: '20px' }}>
                            <div className="flex items-center justify-between mb-16">
                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selected.size} Questions Picked</div>
                                <button className="btn btn-secondary btn-sm" onClick={() => openAssign(assignModal, !assignShowAll)}>
                                    {assignShowAll ? 'Apply Topic Filter' : 'Show All Course Questions'}
                                </button>
                            </div>

                            {loadingAssign ? <div className="loading-wrap" style={{ height: 200 }}><div className="spinner" /></div> : (
                                <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {availQ.length === 0 ? <p className="text-center py-20 text-muted">No questions found</p> : availQ.map(q => {
                                        const isSel = selected.has(q.id);
                                        return (
                                            <div key={q.id} className={`card card-sm clickable ${isSel ? 'selected' : ''}`}
                                                style={{ borderColor: isSel ? 'var(--accent)' : 'var(--border)', cursor: 'pointer', background: isSel ? 'var(--accent-dim)' : 'var(--bg-card)' }}
                                                onClick={() => {
                                                    const next = new Set(selected);
                                                    isSel ? next.delete(q.id) : next.add(q.id);
                                                    setSelected(next);
                                                }}>
                                                <div className="flex items-start gap-12">
                                                    <div className={`checkbox-custom ${isSel ? 'checked' : ''}`} style={{ width: 18, height: 18, border: '1px solid var(--border)', borderRadius: 4, background: isSel ? 'var(--accent)' : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginTop: 2 }}>
                                                        {isSel && <Check size={12} />}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <div className="flex items-center gap-8 mb-4">
                                                            <span className="badge badge-blue">{q.topic?.title || 'No Topic'}</span>
                                                            <span className={`badge ${q.difficulty === 'EASY' ? 'badge-green' : q.difficulty === 'HARD' ? 'badge-red' : 'badge-amber'}`}>{q.difficulty}</span>
                                                            <span className="badge badge-indigo">{q.marks} pts</span>
                                                        </div>
                                                        <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>{q.questionText}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setAssignModal(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleAssign}>Save Selection</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
