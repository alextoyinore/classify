import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, X, UserPlus } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const LEVELS = [100, 200, 300, 400, 500];
const GENDERS = ['MALE', 'FEMALE', 'OTHER'];

const empty = { firstName: '', lastName: '', middleName: '', email: '', password: '', matricNumber: '', gender: 'MALE', dateOfBirth: '', phone: '', address: '', departmentId: '', facultyId: '', facultyName: '', level: 100, entryYear: new Date().getFullYear().toString() };

export default function StudentsPage() {
    const toast = useToast();
    const [students, setStudents] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [dept, setDept] = useState('');
    const [level, setLevel] = useState('');
    const [page, setPage] = useState(1);
    const [depts, setDepts] = useState([]);
    const [facs, setFacs] = useState([]);
    const limit = 20;

    const [modal, setModal] = useState(null); // null | 'add' | 'edit'
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const params = { page, limit, search, department: dept, level: level || undefined };
            const [{ data: sData }, { data: dData }, { data: fData }] = await Promise.all([
                api.get('/students', { params }),
                api.get('/departments'),
                api.get('/faculties')
            ]);
            setStudents(sData.data);
            setTotal(sData.total);
            setDepts(dData || []);
            setFacs(fData || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, [page, search, dept, level]);

    const openAdd = () => { setForm(empty); setModal('add'); };
    const openEdit = (s) => {
        setForm({
            firstName: s.firstName, lastName: s.lastName, middleName: s.middleName || '',
            email: s.user?.email || '', password: '',
            matricNumber: s.matricNumber, gender: s.gender,
            dateOfBirth: s.dateOfBirth ? s.dateOfBirth.substring(0, 10) : '',
            phone: s.phone || '', address: s.address || '',
            departmentId: s.departmentId || '',
            facultyId: s.facultyId || '',
            facultyName: s.faculty?.name || '',
            level: s.level, entryYear: s.entryYear,
            _id: s.id,
        });
        setModal('edit');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal === 'add') {
                await api.post('/students', form);
                toast('Student added');
            } else {
                await api.put(`/students/${form._id}`, form);
                toast('Student updated');
            }
            setModal(null);
            load();
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to save', 'error');
        }
        setSaving(false);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
        try {
            await api.delete(`/students/${id}`);
            toast('Student deleted');
            load();
        } catch (err) {
            toast(err.response?.data?.error || 'Delete failed', 'error');
        }
    };

    const pages = Math.ceil(total / limit);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Students</h1>
                    <p className="page-subtitle">{total} registered students</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <UserPlus size={16} /> Add Student
                </button>
            </div>

            <div className="search-bar">
                <div className="search-input-wrap flex-260">
                    <Search className="search-icon" size={16} />
                    <input placeholder="Search name or matric…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                </div>
                <select value={dept} onChange={e => { setDept(e.target.value); setPage(1); }} className="w-200">
                    <option value="">All Departments</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} className="w-140">
                    <option value="">All Levels</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}L</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-wrap"><div className="spinner" /></div>
            ) : !students || students.length === 0 ? (
                <div className="empty"><Search size={48} /><p>No students found</p></div>
            ) : (
                <>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Matric No.</th>
                                    <th>Department</th>
                                    <th>Level</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(s => (
                                    <tr key={s.id}>
                                        <td>
                                            <Link to={`/students/${s.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                                {s.firstName} {s.lastName}
                                            </Link>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{s.matricNumber}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{s.department?.name || '—'}</td>
                                        <td><span className="badge badge-blue">{s.level}L</span></td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.user?.email}</td>
                                        <td><span className={`badge ${s.isActive ? 'badge-green' : 'badge-red'}`}>{s.isActive ? 'Active' : 'Inactive'}</span></td>
                                        <td>
                                            <div className="flex gap-8">
                                                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(s)} title="Edit"><Edit2 size={14} /></button>
                                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)} title="Delete"><Trash2 size={14} /></button>
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

            {/* Add / Edit Modal */}
            {modal && (
                <div className="modal-backdrop" onClick={() => setModal(null)}>
                    <div className="modal max-w-680" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{modal === 'add' ? 'Add New Student' : 'Edit Student'}</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setModal(null)}><X size={16} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group"><label>First Name *</label><input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} /></div>
                                    <div className="form-group"><label>Last Name *</label><input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Middle Name</label><input value={form.middleName} onChange={e => setForm(f => ({ ...f, middleName: e.target.value }))} /></div>
                                    <div className="form-group"><label>Gender *</label>
                                        <select required value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                                            {GENDERS.map(g => <option key={g}>{g}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Email *</label><input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                                    <div className="form-group"><label>{modal === 'add' ? 'Password *' : 'New Password (leave blank to keep)'}</label><input type="password" required={modal === 'add'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Matric Number *</label><input required value={form.matricNumber} onChange={e => setForm(f => ({ ...f, matricNumber: e.target.value }))} /></div>
                                    <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label>Department *</label>
                                        <select required value={form.departmentId} onChange={e => {
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
                                <div className="form-row">
                                    <div className="form-group"><label>Level *</label>
                                        <select required value={form.level} onChange={e => setForm(f => ({ ...f, level: Number(e.target.value) }))}>
                                            {LEVELS.map(l => <option key={l} value={l}>{l}L</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label>Entry Year *</label><input required value={form.entryYear} onChange={e => setForm(f => ({ ...f, entryYear: e.target.value }))} /></div>
                                </div>
                                <div className="form-group"><label>Date of Birth</label><input type="date" value={form.dateOfBirth} onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} /></div>
                                <div className="form-group"><label>Address</label><textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Add Student' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
