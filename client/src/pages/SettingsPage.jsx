import { useEffect, useState } from 'react';
import { Save, Settings } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const defaultForm = {
    schoolName: '', schoolAcronym: '', schoolAddress: '',
    schoolEmail: '', schoolPhone: '', logoUrl: '',
    currentSession: '', currentSemester: 'FIRST',
};

export default function SettingsPage() {
    const toast = useToast();
    const [form, setForm] = useState(defaultForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/settings');
                setForm({ ...defaultForm, ...data.settings });
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

                {/* Academic session */}
                <div className="card" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 20 }}>Current Academic Session</h2>

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
                </div>

                {/* Logo */}
                <div className="card" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Logo</h2>
                    <div className="form-group">
                        <label>Logo URL</label>
                        <input placeholder="https://…/logo.png or /logo.png" value={form.logoUrl} onChange={set('logoUrl')} />
                    </div>
                    {form.logoUrl && (
                        <img src={form.logoUrl} alt="Logo preview"
                            style={{ marginTop: 12, maxHeight: 72, maxWidth: 200, objectFit: 'contain', borderRadius: 8 }}
                            onError={e => e.target.style.display = 'none'}
                        />
                    )}
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 160 }}>
                    <Save size={16} />
                    {saving ? 'Saving…' : 'Save Settings'}
                </button>
            </form>
        </div>
    );
}
