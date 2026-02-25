import { useEffect, useState } from 'react';
import { Cloud, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function CloudSyncPage() {
    const toast = useToast();
    const [status, setStatus] = useState(null);
    const [logs, setLogs] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const [stRes, lgRes] = await Promise.all([
                api.get('/sync/status'),
                api.get('/sync/logs'),
            ]);
            setStatus(stRes.data);
            setLogs(lgRes.data || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleBackup = async () => {
        setSyncing(true);
        try {
            const { data } = await api.post('/sync/backup');
            toast(`Backup complete — ${data.recordCount || 0} records synced`);
            load();
        } catch (err) {
            toast(err.response?.data?.error || 'Backup failed', 'error');
        }
        setSyncing(false);
    };

    const statusIcon = (s) => {
        if (s === 'SUCCESS') return <CheckCircle size={16} color="var(--accent)" />;
        if (s === 'FAILED') return <XCircle size={16} color="var(--danger)" />;
        return <Clock size={16} color="var(--amber)" />;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cloud Sync</h1>
                    <p className="page-subtitle">Back up platform data to Supabase</p>
                </div>
                <button className="btn btn-primary" onClick={handleBackup} disabled={syncing}>
                    <RefreshCw size={16} className={syncing ? 'spin' : ''} />
                    {syncing ? 'Backing up…' : 'Backup Now'}
                </button>
            </div>

            {/* Status card */}
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--info-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Cloud size={28} color="var(--info)" />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Supabase Connection</div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)' }}>
                            {status?.connected ? '● Connected' : '● Not configured'}
                        </div>
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Last Successful Backup</div>
                    <div style={{ fontWeight: 700 }}>
                        {status?.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Records Synced</div>
                    <div style={{ fontWeight: 700 }}>{status?.lastCount ?? '—'}</div>
                </div>
            </div>

            {/* Info box */}
            <div className="card" style={{ marginBottom: 24, padding: '16px 20px', background: 'var(--info-dim)', borderColor: 'rgba(91,156,246,0.3)' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--info)' }}>
                    <strong>How it works:</strong> Cloud sync copies Students, Scores, Attendance, and CBT Attempts to your Supabase project.
                    The sync is one-way (local → cloud) and safe to run multiple times. Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_KEY</code> in <code>server/.env</code> to enable.
                </p>
            </div>

            {/* Sync log */}
            {loading ? <div className="loading-wrap"><div className="spinner" /></div> : logs.length === 0 ? (
                <div className="empty"><Cloud size={48} /><p>No sync history yet</p></div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead><tr><th>Started</th><th>Status</th><th>Records</th><th>Completed</th><th>Error</th></tr></thead>
                        <tbody>
                            {logs.map(l => (
                                <tr key={l.id}>
                                    <td style={{ fontSize: '0.85rem' }}>{new Date(l.startedAt).toLocaleString()}</td>
                                    <td>
                                        <div className="flex items-center gap-8">
                                            {statusIcon(l.status)}
                                            <span className={`badge ${l.status === 'SUCCESS' ? 'badge-green' : l.status === 'FAILED' ? 'badge-red' : 'badge-amber'}`}>{l.status}</span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{l.recordCount ?? '—'}</td>
                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {l.completedAt ? new Date(l.completedAt).toLocaleString() : '—'}
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{l.errorMsg || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
