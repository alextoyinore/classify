import { useEffect, useState } from 'react';
import { Building2, Plus, Edit2, Trash2, ChevronRight, School } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function AcademicStructurePage() {
    const toast = useToast();
    const [faculties, setFaculties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('list'); // 'list' or 'departments'
    const [activeFaculty, setActiveFaculty] = useState(null);
    const [depts, setDepts] = useState([]);

    // Form states
    const [showFacModal, setShowFacModal] = useState(false);
    const [facForm, setFacForm] = useState({ id: '', name: '', description: '' });
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [deptForm, setDeptForm] = useState({ id: '', name: '' });

    useEffect(() => {
        fetchFaculties();
    }, []);

    const fetchFaculties = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/faculties');
            setFaculties(data);
        } catch { toast('Failed to load faculties', 'error'); }
        setLoading(false);
    };

    const fetchDepartments = async (facultyId) => {
        try {
            const { data } = await api.get(`/departments?facultyId=${facultyId}`);
            setDepts(data);
        } catch { toast('Failed to load departments', 'error'); }
    };

    const handleFacSubmit = async (e) => {
        e.preventDefault();
        try {
            if (facForm.id) {
                await api.put(`/faculties/${facForm.id}`, facForm);
                toast('Faculty updated');
            } else {
                await api.post('/faculties', facForm);
                toast('Faculty created');
            }
            setShowFacModal(false);
            fetchFaculties();
            setFacForm({ id: '', name: '', description: '' });
        } catch (err) { toast(err.response?.data?.error || 'Save failed', 'error'); }
    };

    const handleDeptSubmit = async (e) => {
        e.preventDefault();
        try {
            if (deptForm.id) {
                await api.put(`/departments/${deptForm.id}`, { ...deptForm, facultyId: activeFaculty.id });
                toast('Department updated');
            } else {
                await api.post('/departments', { ...deptForm, facultyId: activeFaculty.id });
                toast('Department created');
            }
            setShowDeptModal(false);
            fetchDepartments(activeFaculty.id);
            setDeptForm({ id: '', name: '' });
        } catch (err) { toast(err.response?.data?.error || 'Save failed', 'error'); }
    };

    const deleteFaculty = async (id) => {
        if (!confirm('Are you sure? This will delete all departments within this faculty.')) return;
        try {
            await api.delete(`/faculties/${id}`);
            toast('Faculty deleted');
            fetchFaculties();
        } catch { toast('Delete failed', 'error'); }
    };

    const deleteDept = async (id) => {
        if (!confirm('Are you sure?')) return;
        try {
            await api.delete(`/departments/${id}`);
            toast('Department deleted');
            fetchDepartments(activeFaculty.id);
        } catch { toast('Delete failed', 'error'); }
    };

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

    return (
        <div className="academic-structure">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        {view === 'departments' ? (
                            <div className="flex items-center gap-8">
                                <button className="btn btn-secondary btn-sm" onClick={() => setView('list')}>Faculties</button>
                                <ChevronRight size={16} />
                                {activeFaculty.name}
                            </div>
                        ) : 'Academic Structure'}
                    </h1>
                    <p className="page-subtitle">Manage faculties and departments within the platform</p>
                </div>
                {view === 'list' ? (
                    <button className="btn btn-primary" onClick={() => { setFacForm({ id: '', name: '', description: '' }); setShowFacModal(true); }}>
                        <Plus size={16} /> Add Faculty
                    </button>
                ) : (
                    <button className="btn btn-primary" onClick={() => { setDeptForm({ id: '', name: '' }); setShowDeptModal(true); }}>
                        <Plus size={16} /> Add Department
                    </button>
                )}
            </div>

            {view === 'list' ? (
                <div className="grid grid-3 gap-24">
                    {faculties.map(f => (
                        <div key={f.id} className="card faculty-card">
                            <div className="flex justify-between items-start mb-16">
                                <div className="stat-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                                    <Building2 size={24} />
                                </div>
                                <div className="flex gap-4">
                                    <button className="btn btn-sm btn-ghost" onClick={() => { setFacForm(f); setShowFacModal(true); }}>
                                        <Edit2 size={14} />
                                    </button>
                                    <button className="btn btn-sm btn-ghost text-red" onClick={() => deleteFaculty(f.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>{f.name}</h3>
                            <p className="text-muted mb-16" style={{ fontSize: '0.85rem', minHeight: 40 }}>{f.description || 'No description provided.'}</p>
                            <div className="flex items-center justify-between pt-16" style={{ borderTop: '1px solid var(--border)' }}>
                                <span className="badge badge-blue">{f._count?.departments || 0} Departments</span>
                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                    setActiveFaculty(f);
                                    setView('departments');
                                    fetchDepartments(f.id);
                                }}>
                                    Manage <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {faculties.length === 0 && (
                        <div className="card col-span-3 py-48 text-center text-muted">
                            <School size={48} className="mx-auto mb-16" style={{ opacity: 0.2 }} />
                            <p>No faculties created yet. Start by adding one!</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="card">
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Department Name</th>
                                    <th className="w-140">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {depts.map(d => (
                                    <tr key={d.id}>
                                        <td className="font-600">{d.name}</td>
                                        <td>
                                            <div className="flex gap-8">
                                                <button className="btn btn-sm btn-secondary" onClick={() => { setDeptForm(d); setShowDeptModal(true); }}>
                                                    <Edit2 size={14} />
                                                </button>
                                                <button className="btn btn-sm btn-secondary" onClick={() => deleteDept(d.id)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {depts.length === 0 && (
                                    <tr>
                                        <td colSpan="2" className="text-center py-24 text-muted">No departments in this faculty</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Faculty Modal */}
            {showFacModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="mb-20">{(facForm.id ? 'Edit' : 'Add') + ' Faculty'}</h2>
                        <form onSubmit={handleFacSubmit}>
                            <div className="form-group mb-16">
                                <label>Faculty Name *</label>
                                <input required value={facForm.name} onChange={e => setFacForm({ ...facForm, name: e.target.value })} autoFocus />
                            </div>
                            <div className="form-group mb-24">
                                <label>Description</label>
                                <textarea
                                    value={facForm.description || ''}
                                    onChange={e => setFacForm({ ...facForm, description: e.target.value })}
                                    style={{ minHeight: 80 }}
                                />
                            </div>
                            <div className="flex justify-end gap-12">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowFacModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Faculty</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Department Modal */}
            {showDeptModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2 className="mb-20">{(deptForm.id ? 'Edit' : 'Add') + ' Department'}</h2>
                        <form onSubmit={handleDeptSubmit}>
                            <div className="form-group mb-24">
                                <label>Department Name *</label>
                                <input required value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} autoFocus />
                            </div>
                            <div className="flex justify-end gap-12">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowDeptModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Department</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
