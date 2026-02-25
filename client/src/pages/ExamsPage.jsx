import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, FileText } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const empty = { title: '', courseId: '', semesterId: '', type: 'WRITTEN', examDate: '', totalMarks: 100 };

export default function ExamsPage() {
    const toast = useToast();
    const [exams, setExams] = useState([]);
    const [courses, setCourses] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [scoreModal, setScoreModal] = useState(null); // { exam, students }
    const [scoreEntries, setScoreEntries] = useState({});

    const load = async () => {
        setLoading(true);
        try {
            const [eRes, cRes, sRes] = await Promise.all([
                api.get('/exams'),
                api.get('/courses'),
                api.get('/sessions'),
            ]);
            setExams(eRes.data.data || []);
            setCourses(cRes.data.data || []);
            setSessions(sRes.data || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const openAdd = () => { setForm(empty); setModal('add'); };
    const openEdit = (ex) => {
        setForm({
            title: ex.title, courseId: ex.courseId, semesterId: ex.semesterId, type: ex.type,
            examDate: ex.examDate ? ex.examDate.substring(0, 10) : '', totalMarks: ex.totalMarks, _id: ex.id
        });
        setModal('edit');
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (modal === 'add') { await api.post('/exams', form); toast('Exam created'); }
            else { await api.put(`/exams/${form._id}`, form); toast('Exam updated'); }
            setModal(null); load();
        } catch (err) { toast(err.response?.data?.error || 'Failed', 'error'); }
        setSaving(false);
    };

    const handleDelete = async (id, title) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try { await api.delete(`/exams/${id}`); toast('Exam deleted'); load(); }
        catch (err) { toast(err.response?.data?.error || 'Delete failed', 'error'); }
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

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Examinations</h1>
                    <p className="page-subtitle">Schedule exams and enter scores</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Exam</button>
            </div>

            {loading ? <div className="loading-wrap"><div className="spinner" /></div> :
                exams.length === 0 ? <div className="empty"><FileText size={48} /><p>No exams scheduled</p></div> : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Title</th><th>Course</th><th>Type</th><th>Date</th><th>Total Marks</th><th>Actions</th></tr></thead>
                            <tbody>
                                {exams.map(ex => (
                                    <tr key={ex.id}>
                                        <td style={{ fontWeight: 600 }}>{ex.title}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{ex.course?.code}</td>
                                        <td><span className={`badge ${ex.type === 'CBT' ? 'badge-blue' : 'badge-muted'}`}>{ex.type}</span></td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{ex.examDate ? new Date(ex.examDate).toLocaleDateString() : '—'}</td>
                                        <td style={{ textAlign: 'center' }}>{ex.totalMarks}</td>
                                        <td>
                                            <div className="flex gap-8">
                                                <button className="btn btn-amber btn-sm" onClick={() => openScores(ex)}>Scores</button>
                                                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(ex)}><Edit2 size={14} /></button>
                                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(ex.id, ex.title)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

            {/* Add/Edit Modal */}
            {modal && (
                <div className="modal-backdrop" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
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
                                    <div className="form-group"><label>Type</label>
                                        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                                            <option>WRITTEN</option><option>CBT</option><option>PRACTICAL</option>
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Total Marks</label>
                                        <input type="number" min={1} value={form.totalMarks} onChange={e => setForm(f => ({ ...f, totalMarks: Number(e.target.value) }))} />
                                    </div>
                                </div>
                                <div className="form-group"><label>Exam Date</label><input type="date" value={form.examDate} onChange={e => setForm(f => ({ ...f, examDate: e.target.value }))} /></div>
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
        </div>
    );
}
