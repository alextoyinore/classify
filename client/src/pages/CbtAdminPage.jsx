import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, BookOpen, Check, Upload, Save, Filter } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const emptyQ = { courseId: '', questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctOption: 'A', explanation: '', marks: 1, difficulty: 'MEDIUM', topicId: '' };

export default function CbtAdminPage() {
    const toast = useToast();
    const [courses, setCourses] = useState([]);

    // Questions State
    const [questions, setQuestions] = useState([]);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [loading, setLoading] = useState(true);
    const [qModal, setQModal] = useState(null);
    const [qForm, setQForm] = useState(emptyQ);
    const [qCourse, setQCourse] = useState('');
    const [qTopic, setQTopic] = useState('');
    const [qPage, setQPage] = useState(1);
    const qLimit = 100;
    const [courseTopics, setCourseTopics] = useState([]);

    // Batch Upload State
    const [bModal, setBModal] = useState(false);
    const [bFile, setBFile] = useState(null);
    const [bText, setBText] = useState('');
    const [bMode, setBMode] = useState('file'); // 'file' | 'text'
    const [replaceExisting, setReplaceExisting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/courses');
                setCourses(data.data || []);
            } catch { }
        })();
    }, []);

    const loadQuestions = async () => {
        setLoading(true);
        try {
            const params = {
                courseId: qCourse || undefined,
                topicId: qTopic || undefined,
                page: qPage,
                limit: qLimit
            };
            const { data } = await api.get('/cbt/questions', { params });
            setQuestions(data.data || []);
            setTotalQuestions(data.total || 0);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { setQPage(1); loadQuestions(); }, [qCourse, qTopic]);
    useEffect(() => { loadQuestions(); }, [qPage]);

    useEffect(() => {
        if (!qCourse) { setCourseTopics([]); return; }
        (async () => {
            try {
                const { data } = await api.get(`/courses/${qCourse}`);
                setCourseTopics(data.topics || []);
            } catch { }
        })();
    }, [qCourse]);

    useEffect(() => {
        if (!qForm.courseId) return;
        (async () => {
            try {
                const { data } = await api.get(`/courses/${qForm.courseId}`);
                setCourseTopics(data.topics || []);
            } catch { }
        })();
    }, [qForm.courseId]);

    const handleSaveQ = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (qModal === 'add') {
                await api.post('/cbt/questions', qForm);
                toast('Question added successfully');
            } else {
                await api.put(`/cbt/questions/${qForm.id}`, qForm);
                toast('Question updated');
            }
            setQModal(null);
            loadQuestions();
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
        setSaving(false);
    };

    const handleDeleteQ = async (id) => {
        if (!confirm('Permanently delete this question?')) return;
        try {
            await api.delete(`/cbt/questions/${id}`);
            toast('Question removed');
            loadQuestions();
        } catch { toast('Delete failed', 'error'); }
    };

    const handleBatchUpload = async (e) => {
        e.preventDefault();
        setUploading(true);
        const submit = async (questionsArray) => {
            try {
                if (!Array.isArray(questionsArray)) throw new Error('Invalid format: expected a JSON array');
                if (replaceExisting && qTopic) {
                    await api.delete(`/cbt/questions/topic/${qTopic}`);
                }
                await api.post('/cbt/questions/batch', {
                    courseId: qCourse,
                    topicId: qTopic || undefined,
                    questions: questionsArray
                });
                toast(`Successfully uploaded ${questionsArray.length} questions`);
                setBModal(false); setBFile(null); setBText(''); setReplaceExisting(false);
                loadQuestions();
            } catch (err) {
                toast(err.response?.data?.error || err.message || 'Upload failed', 'error');
            } finally { setUploading(false); }
        };

        if (bMode === 'text') {
            try { const questionsArray = JSON.parse(bText); await submit(questionsArray); }
            catch (err) { toast('Invalid JSON: ' + err.message, 'error'); setUploading(false); }
        } else {
            if (!bFile) { setUploading(false); return; }
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try { const questionsArray = JSON.parse(ev.target.result); await submit(questionsArray); }
                catch (err) { toast('Invalid JSON in file: ' + err.message, 'error'); setUploading(false); }
            };
            reader.readAsText(bFile);
        }
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Question Library</h1>
                    <p className="page-subtitle">Central repository for all course examination questions</p>
                </div>
                <div className="flex gap-12">
                    <button className="btn btn-secondary" onClick={() => setBModal(true)} disabled={!qCourse}>
                        <Upload size={16} /> Batch Upload
                    </button>
                    <button className="btn btn-primary" onClick={() => { setQForm({ ...emptyQ, courseId: qCourse, topicId: qTopic }); setQModal('add'); }}>
                        <Plus size={16} /> Add Question
                    </button>
                </div>
            </div>

            <div className="card shadow-sm mb-24" style={{ padding: '16px 20px' }}>
                <div className="flex items-center gap-16 flex-wrap">
                    <div className="flex items-center gap-8">
                        <Filter size={16} className="text-muted" />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filter:</span>
                    </div>
                    <select value={qCourse} onChange={e => { setQCourse(e.target.value); setQTopic(''); }} style={{ width: 240, height: 38 }}>
                        <option value="">All Courses</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                    </select>
                    <select value={qTopic} onChange={e => setQTopic(e.target.value)} style={{ width: 200, height: 38 }} disabled={!qCourse}>
                        <option value="">All Topics</option>
                        {courseTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                    <div style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Total: <strong>{totalQuestions} questions</strong>
                    </div>
                </div>
            </div>

            {loading ? <div className="loading-wrap"><div className="spinner" /></div> :
                questions.length === 0 ? <div className="empty"><BookOpen size={48} /><p>No questions found in this bank yet</p></div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {questions.map((q, idx) => (
                            <div key={q.id} className="card shadow-hover transition-all">
                                <div className="flex items-center justify-between mb-12">
                                    <div className="flex items-center gap-12">
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                            {idx + 1 + (qPage - 1) * qLimit}
                                        </div>
                                        <div className="flex gap-8">
                                            {q.topic && <span className="badge badge-blue">{q.topic.title}</span>}
                                            <span className="badge badge-muted">{q.course?.code}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-8 items-center">
                                        <span className={`badge ${q.difficulty === 'EASY' ? 'badge-green' : q.difficulty === 'HARD' ? 'badge-red' : 'badge-amber'}`}>{q.difficulty}</span>
                                        <span className="badge badge-indigo">{q.marks} pts</span>
                                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => { setQForm({ ...q, id: q.id }); setQModal('edit'); }}><Edit2 size={14} /></button>
                                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteQ(q.id)}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <p style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.5, color: 'var(--text-main)', marginBottom: 16 }}>{q.questionText}</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                                    {['A', 'B', 'C', 'D'].map(opt => (
                                        <div key={opt} style={{
                                            padding: '12px 16px', borderRadius: 8, fontSize: '0.85rem',
                                            display: 'flex', gap: 10,
                                            background: q.correctOption === opt ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                                            border: `1px solid ${q.correctOption === opt ? 'var(--accent)' : 'var(--border)'}`,
                                            color: q.correctOption === opt ? 'var(--accent-dark)' : 'var(--text-secondary)',
                                            fontWeight: q.correctOption === opt ? 600 : 400
                                        }}>
                                            <strong style={{ opacity: 0.7 }}>{opt}.</strong> {q[`option${opt}`]}
                                            {q.correctOption === opt && <Check size={14} style={{ marginLeft: 'auto' }} />}
                                        </div>
                                    ))}
                                </div>
                                {q.explanation && (
                                    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--border)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        <strong>Explanation:</strong> {q.explanation}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            {/* Pagination Placeholder */}
            {totalQuestions > qLimit && (
                <div className="flex justify-center mt-32 gap-8">
                    {[...Array(Math.ceil(totalQuestions / qLimit))].map((_, i) => (
                        <button key={i} className={`btn btn-sm ${qPage === i + 1 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQPage(i + 1)}>
                            {i + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* Question Entry Modal */}
            {qModal && (
                <div className="modal-backdrop" onClick={() => setQModal(null)}>
                    <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{qModal === 'add' ? 'Add New Question' : 'Edit Question Definition'}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setQModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSaveQ}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group"><label>Course *</label>
                                        <select required value={qForm.courseId} onChange={e => setQForm(f => ({ ...f, courseId: e.target.value, topicId: '' }))}>
                                            <option value="">Select Course…</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Topic</label>
                                        <select value={qForm.topicId || ''} onChange={e => setQForm(f => ({ ...f, topicId: e.target.value }))} disabled={!qForm.courseId}>
                                            <option value="">No Topic / General</option>
                                            {courseTopics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Difficulty</label>
                                        <select value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: e.target.value }))}>
                                            <option>EASY</option><option>MEDIUM</option><option>HARD</option>
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Marks / Point</label>
                                        <input type="number" min={0.5} step={0.5} value={qForm.marks} onChange={e => setQForm(f => ({ ...f, marks: Number(e.target.value) }))} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Question Prompt *</label>
                                    <textarea required rows={3} value={qForm.questionText} onChange={e => setQForm(f => ({ ...f, questionText: e.target.value }))} placeholder="Enter the question text here..." />
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Option A *</label><input required value={qForm.optionA} onChange={e => setQForm(f => ({ ...f, optionA: e.target.value }))} /></div>
                                    <div className="form-group"><label>Option B *</label><input required value={qForm.optionB} onChange={e => setQForm(f => ({ ...f, optionB: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Option C *</label><input required value={qForm.optionC} onChange={e => setQForm(f => ({ ...f, optionC: e.target.value }))} /></div>
                                    <div className="form-group"><label>Option D *</label><input required value={qForm.optionD} onChange={e => setQForm(f => ({ ...f, optionD: e.target.value }))} /></div>
                                </div>
                                <div className="form-group">
                                    <label className="mb-8 block">Select Correct Option *</label>
                                    <div className="flex gap-24">
                                        {['A', 'B', 'C', 'D'].map(opt => (
                                            <label key={opt} className="flex items-center gap-8 cursor-pointer group">
                                                <input type="radio" name="correct" style={{ width: 18, height: 18 }} checked={qForm.correctOption === opt} onChange={() => setQForm(f => ({ ...f, correctOption: opt }))} />
                                                <span className="font-bold group-hover:text-accent transition-colors">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="form-group mt-12"><label>Explanation (Optional)</label><textarea rows={2} value={qForm.explanation} onChange={e => setQForm(f => ({ ...f, explanation: e.target.value }))} placeholder="Explain why the answer is correct..." /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setQModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    <Save size={16} /> {saving ? 'Saving…' : 'Save Question'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Batch Upload Modal */}
            {bModal && (
                <div className="modal-backdrop" onClick={() => setBModal(false)}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Batch Import Questions</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setBModal(false)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleBatchUpload}>
                            <div className="modal-body">
                                <div className="tabs tabs-sm mb-16">
                                    <button type="button" className={`tab-btn ${bMode === 'file' ? 'active' : ''}`} onClick={() => setBMode('file')}>JSON File</button>
                                    <button type="button" className={`tab-btn ${bMode === 'text' ? 'active' : ''}`} onClick={() => setBMode('text')}>Paste Content</button>
                                </div>

                                <div className="form-group">
                                    <label>Importing into Course:</label>
                                    <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 700 }}>
                                        {courses.find(c => c.id === qCourse)?.code} — {courses.find(c => c.id === qCourse)?.title}
                                    </div>
                                </div>

                                {bMode === 'file' ? (
                                    <div className="form-group">
                                        <label>Select JSON File *</label>
                                        <input type="file" accept=".json" onChange={e => setBFile(e.target.files[0])} required />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>Paste JSON Array *</label>
                                        <textarea
                                            placeholder="Paste questions here..."
                                            style={{ height: 180, fontFamily: 'monospace', fontSize: '0.8rem' }}
                                            value={bText}
                                            onChange={e => setBText(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}

                                {qTopic && (
                                    <div className="form-group mb-0">
                                        <label className="flex items-center gap-8 cursor-pointer">
                                            <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)} />
                                            <span>Wipe existing questions in <strong>{courseTopics.find(t => t.id === qTopic)?.title}</strong> first?</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setBModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={uploading || (bMode === 'file' ? !bFile : !bText.trim())}>
                                    {uploading ? 'Processing...' : 'Start Import'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
