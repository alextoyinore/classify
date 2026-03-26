import { useEffect, useState, useRef } from 'react';
import { Save, Settings, Upload, RefreshCw } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const defaultForm = {
    schoolName: '', schoolAcronym: '', schoolAddress: '',
    schoolEmail: '', schoolPhone: '', logoUrl: '',
    currentSession: '', currentSemester: 'FIRST',
    attendanceWeight: 10,
    examDeletionGraceDays: 3,
};

export default function SettingsPage() {
    const toast = useToast();
    const [form, setForm] = useState(defaultForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [sessionInfo, setSessionInfo] = useState(null);
    const logoInputRef = useRef(null);

    useEffect(() => {
        (async () => {
            try {
                const [{ data: settingsData }, { data: activeSession }] = await Promise.all([
                    api.get('/settings'),
                    api.get('/settings/active-session'),
                ]);
                setSessionInfo(activeSession);
                setForm({ 
                    ...defaultForm, 
                    ...settingsData.settings,
                    currentSession: activeSession?.currentSession || settingsData.settings?.currentSession || defaultForm.currentSession,
                    currentSemester: activeSession?.currentSemester || settingsData.settings?.currentSemester || defaultForm.currentSemester,
                });
            } catch { }
            setLoading(false);
        })();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/settings', form);
            toast('Settings saved');
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to save', 'error');
        }
        setSaving(false);
    };


    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingLogo(true);
        try {
            const formData = new FormData();
            formData.append('logo', file);
            const { data } = await api.post('/settings/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setForm(f => ({ ...f, logoUrl: data.logoUrl }));
            toast('Logo uploaded successfully');
        } catch (err) {
            toast(err.response?.data?.error || 'Upload failed', 'error');
        }
        setUploadingLogo(false);
    };

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Settings</h1>
                    <p className="page-subtitle">Institution profile and academic session configuration</p>
                </div>
            </div>

            <form onSubmit={handleSave}>
                {/* Institution info */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="flex items-center gap-12" style={{ marginBottom: 20 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Settings size={18} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>Institution Profile</h2>
                    </div>

                    <div className="form-row" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label>School Name</label>
                            <input placeholder="e.g. Federal University of Technology" value={form.schoolName} onChange={set('schoolName')} />
                        </div>
                        <div className="form-group">
                            <label>Acronym</label>
                            <input placeholder="e.g. FUT" value={form.schoolAcronym} onChange={set('schoolAcronym')} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label>Address</label>
                        <textarea placeholder="Full institution address" value={form.schoolAddress} onChange={set('schoolAddress')} style={{ minHeight: 60 }} />
                    </div>

                    <div className="form-row" style={{ marginBottom: 0 }}>
                        <div className="form-group">
                            <label>Institutional Email</label>
                            <input type="email" placeholder="info@university.edu.ng" value={form.schoolEmail} onChange={set('schoolEmail')} />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input placeholder="+234 800 000 0000" value={form.schoolPhone} onChange={set('schoolPhone')} />
                        </div>
                    </div>
                </div>

                {/* Logo */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Institution Logo</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                        {/* Preview */}
                        <div style={{
                            width: 80, height: 80, borderRadius: 'var(--radius-sm)',
                            border: '2px dashed var(--border)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            background: 'var(--bg-body)', flexShrink: 0, overflow: 'hidden'
                        }}>
                            {form.logoUrl ? (
                                <img src={form.logoUrl} alt="Logo"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                    onError={e => e.target.style.display = 'none'}
                                />
                            ) : (
                                <Upload size={24} color="var(--text-muted)" />
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <input
                                ref={logoInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleLogoUpload}
                            />
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => logoInputRef.current?.click()}
                                disabled={uploadingLogo}
                                style={{ marginBottom: 8 }}
                            >
                                <Upload size={14} />
                                {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                            </button>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                                PNG, JPG or SVG · Max 5MB. Alternatively paste a URL below.
                            </p>
                            <input
                                style={{ marginTop: 8 }}
                                placeholder="or paste a URL: https://…/logo.png"
                                value={form.logoUrl}
                                onChange={set('logoUrl')}
                            />
                        </div>
                    </div>
                </div>

                {/* Academic session */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                        <h2 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Current Academic Session</h2>
                    </div>

                    {sessionInfo?.currentSession && (
                        <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--accent)' }}>
                            ✓ Active in DB: <strong>{sessionInfo.currentSession}</strong> — <strong>{sessionInfo.currentSemester === 'FIRST' ? 'First' : 'Second'} Semester</strong>
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Academic Session</label>
                            <input placeholder="e.g. 2024/2025" value={form.currentSession} onChange={set('currentSession')} />
                        </div>
                        <div className="form-group">
                            <label>Current Semester</label>
                            <select value={form.currentSemester} onChange={set('currentSemester')}>
                                <option value="FIRST">First Semester</option>
                                <option value="SECOND">Second Semester</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-dim)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--amber)' }}>
                        ⚠ Changing the active session/semester affects attendance marking and CBT exam windows.
                    </div>

                    <div className="form-group" style={{ marginTop: 20 }}>
                        <label>Attendance Weight (Score Max)</label>
                        <input type="number" placeholder="e.g. 10" value={form.attendanceWeight} onChange={e => setForm(f => ({ ...f, attendanceWeight: Number(e.target.value) }))} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            This value is used to calculate the attendance score in the aggregate results.
                        </p>
                    </div>

                    <div className="form-group" style={{ marginTop: 20 }}>
                        <label>Exam Deletion Grace Period (Days)</label>
                        <input type="number" min={0} max={30} value={form.examDeletionGraceDays} onChange={e => setForm(f => ({ ...f, examDeletionGraceDays: Number(e.target.value) }))} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            Number of days after scheduling a full wipe before the manual deletion banner appears for admins. Default is 3 days.
                        </p>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 160 }}>
                    <Save size={16} />
                    {saving ? 'Saving…' : 'Save Settings'}
                </button>
            </form>
        </div>
    );
}
