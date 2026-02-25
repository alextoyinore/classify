import { useEffect, useState } from 'react';
import { User, Phone, MapPin, Mail, Lock, Shield, Save, Camera, ClipboardCheck } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProfilePage() {
    const { user } = useAuth();
    const toast = useToast();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });

    // Active sessions for students
    const [activeSessions, setActiveSessions] = useState([]);
    const [marking, setMarking] = useState(false);

    // Academic Structure
    const [facs, setFacs] = useState([]);
    const [deps, setDeps] = useState([]);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/profile');
            setProfile(data);

            // Fetch academic structure
            const facRes = await api.get('/faculties');
            setFacs(facRes.data || []);

            const depRes = await api.get('/departments');
            setDeps(depRes.data || []);

            // If student, check for active attendance sessions
            if (user?.role === 'STUDENT') {
                const sessRes = await api.get('/attendance/active-sessions');
                setActiveSessions(sessRes.data || []);
            }
        } catch (err) {
            toast('Failed to load profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelfMark = async (courseId, semesterId) => {
        setMarking(true);
        try {
            await api.post('/attendance/self-mark', { courseId, semesterId });
            toast('Attendance marked successfully! ✅');
            setActiveSessions(prev => prev.filter(s => s.courseId !== courseId));
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to mark attendance', 'error');
        } finally {
            setMarking(false);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const roleData = profile.student || profile.instructor || profile.admin;
            await api.put('/profile', roleData);
            toast('Profile updated successfully');
        } catch (err) {
            toast(err.response?.data?.error || 'Update failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handlePwChange = async (e) => {
        e.preventDefault();
        try {
            await api.post('/auth/change-password', pwForm);
            toast('Password updated successfully');
            setPwForm({ currentPassword: '', newPassword: '' });
        } catch (err) {
            toast(err.response?.data?.error || 'Password change failed', 'error');
        }
    };

    const setField = (field, value) => {
        const roleKey = user.role.toLowerCase();
        setProfile(p => ({
            ...p,
            [roleKey]: { ...p[roleKey], [field]: value }
        }));
    };

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

    const roleProfile = profile.student || profile.instructor || profile.admin;
    const nameLabel = user.role === 'ADMIN' ? 'fullName' : 'firstName';

    return (
        <div className="profile-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Personal Settings</h1>
                    <p className="page-subtitle">Manage your account information and security</p>
                </div>
            </div>

            <div className="grid grid-2 gap-32 mt-24">
                <div className="flex flex-col gap-32">
                    {/* Active Attendance Session for Students */}
                    {user?.role === 'STUDENT' && activeSessions.length > 0 && (
                        <div className="card attendance-vibe" style={{ background: 'var(--accent)', color: '#fff', textAlign: 'center' }}>
                            <div className="flex items-center justify-center mb-12">
                                <ClipboardCheck size={32} style={{ opacity: 0.8 }} />
                            </div>
                            <h2 className="mb-4" style={{ color: '#fff', fontSize: '1.1rem' }}>Live Class Active!</h2>
                            <p className="mb-16" style={{ opacity: 0.9, fontSize: '0.85rem' }}>
                                {activeSessions[0].course.code}: {activeSessions[0].course.title}
                                {activeSessions[0].department && ` for ${activeSessions[0].department.name}`}
                                {activeSessions[0].level && ` (${activeSessions[0].level}L)`}
                            </p>
                            <button
                                className="btn btn-white w-full"
                                onClick={() => handleSelfMark(activeSessions[0].courseId, activeSessions[0].semesterId)}
                                disabled={marking}
                            >
                                {marking ? 'Marking...' : 'Mark Me Present'}
                            </button>
                        </div>
                    )}

                    {/* Basic Info */}
                    <form className="card" onSubmit={handleUpdate}>
                        <div className="flex items-center gap-12 mb-20">
                            <div className="stat-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', padding: 8, borderRadius: 8 }}>
                                <User size={20} />
                            </div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Profile Information</h2>
                        </div>

                        <div className="flex items-center gap-16 mb-24">
                            <div className="avatar" style={{ width: 64, height: 64, fontSize: '1.5rem' }}>
                                {(roleProfile.firstName?.[0] || roleProfile.fullName?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                                <button type="button" className="btn btn-secondary btn-sm mb-4">
                                    <Camera size={14} /> Change Avatar
                                </button>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JPG, PNG or GIF. Max size 2MB.</p>
                            </div>
                        </div>

                        <div className="form-group mb-16">
                            <label>Email Address</label>
                            <div className="flex items-center gap-8 text-secondary" style={{ fontSize: '0.9rem', padding: '10px 0' }}>
                                <Mail size={16} /> {profile.email}
                                <span className="badge badge-green">Verified</span>
                            </div>
                        </div>

                        {user.role === 'ADMIN' ? (
                            <div className="form-group mb-16">
                                <label>Full Name</label>
                                <input
                                    value={roleProfile.fullName || ''}
                                    onChange={e => setField('fullName', e.target.value)}
                                    required
                                />
                            </div>
                        ) : (
                            <div className="form-row mb-16">
                                <div className="form-group">
                                    <label>First Name</label>
                                    <input
                                        value={roleProfile.firstName || ''}
                                        onChange={e => setField('firstName', e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name</label>
                                    <input
                                        value={roleProfile.lastName || ''}
                                        onChange={e => setField('lastName', e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="form-group mb-16">
                            <label>Phone Number</label>
                            <input
                                placeholder="+234..."
                                value={roleProfile.phone || ''}
                                onChange={e => setField('phone', e.target.value)}
                            />
                        </div>

                        {user.role !== 'ADMIN' && (
                            <>
                                <div className="form-row mb-16">
                                    <div className="form-group">
                                        <label>Faculty</label>
                                        <select
                                            value={roleProfile.facultyId || ''}
                                            onChange={e => setField('facultyId', e.target.value)}
                                        >
                                            <option value="">Select Faculty</option>
                                            {facs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Department</label>
                                        <select
                                            value={roleProfile.departmentId || ''}
                                            onChange={e => setField('departmentId', e.target.value)}
                                        >
                                            <option value="" disabled>Select Department</option>
                                            {deps.filter(d => !roleProfile.facultyId || d.facultyId === roleProfile.facultyId).map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group mb-24">
                                    <label>Address</label>
                                    <textarea
                                        placeholder="Enter your residential address"
                                        value={roleProfile.address || ''}
                                        onChange={e => setField('address', e.target.value)}
                                        style={{ minHeight: 80 }}
                                    />
                                </div>
                            </>
                        )}

                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>

                <div className="flex flex-col gap-32">
                    {/* Security */}
                    <form className="card" onSubmit={handlePwChange}>
                        <div className="flex items-center gap-12 mb-20">
                            <div className="stat-icon" style={{ background: 'var(--amber-dim)', color: 'var(--amber)', padding: 8, borderRadius: 8 }}>
                                <Shield size={20} />
                            </div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Security Settings</h2>
                        </div>

                        <div className="form-group mb-16">
                            <label>Current Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={pwForm.currentPassword}
                                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group mb-24">
                            <label>New Password</label>
                            <input
                                type="password"
                                placeholder="At least 8 characters"
                                value={pwForm.newPassword}
                                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-secondary w-full">
                            <Lock size={16} /> Update Password
                        </button>
                    </form>

                    {/* Role Info */}
                    <div className="card" style={{ background: 'var(--bg-body)' }}>
                        <div className="sidebar-section mb-12" style={{ padding: 0 }}>System Identity</div>
                        <div className="flex flex-col gap-12">
                            <div className="flex justify-between items-center py-8" style={{ borderBottom: '1px solid var(--border)' }}>
                                <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Account Role</span>
                                <span className="badge badge-blue">{user.role}</span>
                            </div>
                            <div className="flex justify-between items-center py-8" style={{ borderBottom: '1px solid var(--border)' }}>
                                <span className="text-secondary" style={{ fontSize: '0.85rem' }}>
                                    {user.role === 'STUDENT' ? 'Matric Number' : user.role === 'INSTRUCTOR' ? 'Staff ID' : 'Admin ID'}
                                </span>
                                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                    {roleProfile.matricNumber || roleProfile.staffId || user.id.substring(0, 8)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-8">
                                <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Joined</span>
                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                                    {new Date(profile.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
