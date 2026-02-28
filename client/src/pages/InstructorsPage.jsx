import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';


const empty = { firstName: '', lastName: '', email: '', password: '', staffId: '', phone: '', departmentId: '', facultyId: '', facultyName: '', qualification: '' };

export default function InstructorsPage() {
    const toast = useToast();
    const [instructors, setInstructors] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [depts, setDepts] = useState([]);
    const [facs, setFacs] = useState([]);
    const limit = 20;

    const [modal, setModal] = useState(null);
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: iData }, { data: dData }, { data: fData }] = await Promise.all([
                api.get('/instructors', { params: { page, limit, search } }),
                api.get('/departments'),
                api.get('/faculties')
            ]);
            setInstructors(iData.data);
            setTotal(iData.total);
            setDepts(dData || []);
            setFacs(fData || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, [page, search]);

    const openAdd = () => { setForm(empty); setModal('add'); };
    const openEdit = (i) => {
        setForm({
            firstName: i.firstName, lastName: i.lastName, email: i.user?.email || '', password: '',
            staffId: i.staffId, phone: i.phone || '',
            departmentId: i.departmentId || '',
            facultyId: i.facultyId || '',
            facultyName: i.faculty?.name || '',
            qualification: i.qualification || '', _id: i.id
        });
        setModal('edit');
    };

    const handleSave = async (e) => {
        e.preventDefault(); setSaving(true);
        try {
            if (modal === 'add') { await api.post('/instructors', form); toast('Instructor added'); }
            else { await api.put(`/instructors/${form._id}`, form); toast('Instructor updated'); }
            setModal(null); load();
        } catch (err) { toast(err.response?.data?.error || 'Failed to save', 'error'); }
        setSaving(false);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete ${name}?`)) return;
        try { await api.delete(`/instructors/${id}`); toast('Instructor deleted'); load(); }
        catch (err) { toast(err.response?.data?.error || 'Delete failed', 'error'); }
    };

    const pages = Math.ceil(total / limit);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Instructors</h1>
                    <p className="page-subtitle">{total} staff members</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Instructor</button>
            </div>

            <div className="search-bar">
                <div className="search-input-wrap flex-280">
                    <Search className="search-icon" size={16} />
                    <input placeholder="Search name or staff ID…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
            </div>

            {loading ? <div className="loading-wrap"><div className="spinner" /></div> :
                !instructors || instructors.length === 0 ? <div className="empty"><Search size={48} /><p>No instructors found</p></div> : (
                    <>
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Name</th><th>Staff ID</th><th>Department</th><th>Qualification</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {instructors.map(i => (
                                        <tr key={i.id}>
                                            <td className="font-600">{i.firstName} {i.lastName}</td>
                                            <td className="font-mono text-082 text-muted">{i.staffId}</td>
                                            <td className="text-085">{i.department?.name || '—'}</td>
                                            <td className="text-082 text-muted">{i.qualification || '—'}</td>
                                            <td className="text-08 text-muted">{i.user?.email}</td>
                                            <td><span className={`badge ${i.isActive ? 'badge-green' : 'badge-red'}`}>{i.isActive ? 'Active' : 'Inactive'}</span></td>
                                            <td>
                                                <div className="flex gap-8">
                                                    <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(i)}><Edit2 size={14} /></button>
                                                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(i.id, `${i.firstName} ${i.lastName}`)}><Trash2 size={14} /></button>
                                                </div>
                                            </td>
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
                            <span className="modal-title">{modal === 'add' ? 'Add Instructor' : 'Edit Instructor'}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group"><label>First Name *</label><input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                                    <div className="form-group"><label>Last Name *</label><input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Email *</label><input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                                    <div className="form-group"><label>{modal === 'add' ? 'Password *' : 'New Password'}</label><input type="password" required={modal === 'add'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Staff ID</label><input value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))} /></div>
                                    <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Department</label>
                                        <select value={form.departmentId} onChange={e => {
                                            const dId = e.target.value;
                                            const dObj = depts.find(d => d.id === dId);
                                            setForm(f => ({
                                                ...f,
                                                departmentId: dId,
                                                facultyId: dObj?.facultyId || '',
                                                facultyName: dObj?.faculty?.name || ''
                                            }));
                                        }}>
                                            <option value="">Select Department</option>
                                            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Faculty</label><input readOnly value={form.facultyName} /></div>
                                </div>
                                <div className="form-group"><label>Qualification</label><input placeholder="e.g. MSc Computer Science" value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Add Instructor' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
