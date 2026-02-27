import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, X, BookOpen } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const empty = { code: '', title: '', description: '', creditUnits: '' };

export default function CoursesPage() {
    const toast = useToast();
    const { isAdmin, user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dept, setDept] = useState('');
    const [level, setLevel] = useState('');
    const [page, setPage] = useState(1);
    const limit = 20;
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/courses', { params: { page, limit, search, department: dept, level: level || undefined } });
            setCourses(data.data);
            setTotal(data.total);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, [page, search, dept, level]);

    const openAdd = () => { setForm(empty); setModal('add'); };
    const openEdit = (c) => {
        setForm({ code: c.code || '', title: c.title, description: c.description || '', creditUnits: c.creditUnits || '', _id: c.id });
        setModal('edit');
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (modal === 'add') { await api.post('/courses', form); toast('Course created'); }
            else { await api.put(`/courses/${form._id}`, form); toast('Course updated'); }
            setModal(null); load();
        } catch (err) { toast(err.response?.data?.error || 'Failed to save', 'error'); }
        setSaving(false);
    };

    const handleDelete = async (id, title) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try { await api.delete(`/courses/${id}`); toast('Course deleted'); load(); }
        catch (err) { toast(err.response?.data?.error || 'Delete failed', 'error'); }
    };

    const pages = Math.ceil(total / limit);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Courses</h1>
                    <p className="page-subtitle">{total} courses in catalog</p>
                </div>
                {isAdmin && <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Course</button>}
            </div>

            <div className="search-bar">
                <div className="search-input-wrap" style={{ flexBasis: 260 }}>
                    <Search className="search-icon" size={16} />
                    <input placeholder="Search code or title…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
                {isAdmin && (
                    <select value={dept} onChange={e => { setDept(e.target.value); setPage(1); }} style={{ width: 200 }}>
                        <option value="">All Departments</option>
                    </select>
                )}
                <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} style={{ width: 140 }}>
                    <option value="">All Levels</option>
                    {[100, 200, 300, 400, 500].map(l => <option key={l} value={l}>{l}L</option>)}
                </select>
            </div>

            {loading ? <div className="loading-wrap"><div className="spinner" /></div> :
                courses.length === 0 ? <div className="empty"><BookOpen size={48} /><p>No courses found</p></div> : (
                    <>
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Code</th><th>Title</th><th>Department</th><th>Level</th>{isAdmin && <th>Semester</th>}<th>Credits</th><th>Status</th>{isAdmin && <th>Actions</th>}</tr></thead>
                                <tbody>
                                    {courses.map(c => (
                                        <tr key={c.id}>
                                            <td>
                                                <Link to={`/courses/${c.id}`} style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace' }}>{c.code || 'N/A'}</Link>
                                            </td>
                                            <td style={{ fontWeight: 500 }}>{c.title}</td>
                                            <td style={{ fontSize: '0.85rem' }}>
                                                {isAdmin
                                                    ? (c.departments?.map(d => d.name).join(', ') || 'N/A')
                                                    : (c.departments?.filter(d => d.id === user?.student?.departmentId).map(d => d.name).join(', ') || 'N/A')
                                                }
                                            </td>
                                            <td><span className="badge badge-blue">{c.levels?.map(l => l + 'L').join(', ') || 'N/A'}</span></td>
                                            {isAdmin && (
                                                <td style={{ fontSize: '0.85rem' }}>
                                                    <span className="badge badge-purple">{c.semesters?.join(', ') || 'N/A'}</span>
                                                </td>
                                            )}
                                            <td style={{ textAlign: 'center' }}>{c.creditUnits || 'N/A'}</td>
                                            <td><span className={`badge ${c.isActive ? 'badge-green' : 'badge-red'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                                            {isAdmin && (
                                                <td>
                                                    <div className="flex gap-8">
                                                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(c)}><Edit2 size={14} /></button>
                                                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(c.id, c.title)}><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {pages > 1 && (
                            <div className="pagination">
                                {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                                    <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                                ))}
                            </div>
                        )}
                    </>
                )}

            {modal && (
                <div className="modal-backdrop" onClick={() => setModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{modal === 'add' ? 'Add Course' : 'Edit Course'}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group"><label>Course Code</label><input placeholder="e.g. CSC201 (Optional)" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} /></div>
                                    <div className="form-group"><label>Credit Units</label><input type="number" min={1} max={6} value={form.creditUnits} onChange={e => setForm(f => ({ ...f, creditUnits: e.target.value ? Number(e.target.value) : '' }))} placeholder="Optional" /></div>
                                </div>
                                <div className="form-group"><label>Title *</label><input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                                <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Add Course' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
