import { useEffect, useState } from 'react';
import { Cloud, RefreshCw, CheckCircle, XCircle, Clock, Download, Trash2 } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function CloudSyncPage() {
    const toast = useToast();
    const [status, setStatus] = useState(null);
    const [logs, setLogs] = useState([]);
    const [localBackups, setLocalBackups] = useState([]);
    const [syncing, setSyncing] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        try {
            const [stRes, lgRes, lcRes] = await Promise.all([
                api.get('/sync/status'),
                api.get('/sync/logs'),
                api.get('/sync/local'),
            ]);
            setStatus(stRes.data);
            setLogs(lgRes.data || []);
            setLocalBackups(lcRes.data || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const handleBackup = async () => {
        setSyncing(true);
        try {
            const { data } = await api.post('/sync/backup');
            toast(`Backup complete — ${data.recordCount || 0} records saved`);
            load();
        } catch (err) {
            toast(err.response?.data?.error || 'Backup failed', 'error');
        }
        setSyncing(false);
    };

    const handleDownload = async (filename) => {
        try {
            const response = await api.get(`/sync/local/download/${filename}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toast('Download failed', 'error');
        }
    };

    const handleDeleteLocal = async (filename) => {
        if (!window.confirm(`Delete backup ${filename}?`)) return;
        try {
            await api.delete(`/sync/local/${filename}`);
            toast('Backup deleted');
            load();
        } catch (err) {
            toast('Failed to delete backup', 'error');
        }
    };

    const statusIcon = (s) => {
        if (s === 'SUCCESS') return <CheckCircle size={16} color="var(--accent)" />;
        if (s === 'PARTIAL') return <Clock size={16} color="var(--amber)" />;
        if (s === 'FAILED') return <XCircle size={16} color="var(--danger)" />;
        if (s === 'SKIPPED') return <Clock size={16} color="var(--text-secondary)" />;
        return <Clock size={16} color="var(--amber)" />;
    };

    const StatusBadge = ({ type, status }) => {
        let label = type === 'local' ? 'Local' : 'Cloud';
        let className = 'badge-secondary';
        if (status === 'SUCCESS') className = 'badge-green';
        else if (status === 'FAILED') className = 'badge-red';
        else if (status === 'SKIPPED') className = 'badge-gray';
        else if (status === 'PARTIAL') className = 'badge-amber';

        return (
            <span className={`badge ${className}`} style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                {label}: {status || 'PENDING'}
            </span>
        );
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Sync & Backups</h1>
                    <p className="page-subtitle">Platform data redundancy (Cloud + Local)</p>
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

            {/* Local Backups */}
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '32px 0 16px' }}>Local Data Dumps</h2>
            {loading ? <div className="loading-wrap"><div className="spinner" /></div> : localBackups.length === 0 ? (
                <div className="empty" style={{ padding: '20px 0' }}><p>No local backups yet</p></div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Filename</th>
                                <th>Size</th>
                                <th>Date Created</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localBackups.map(b => (
                                <tr key={b.filename}>
                                    <td style={{ fontWeight: 600 }}>{b.filename}</td>
                                    <td>{(b.size / 1024).toFixed(1)} KB</td>
                                    <td style={{ fontSize: '0.85rem' }}>{new Date(b.createdAt).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="flex justify-end gap-8">
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(b.filename)}>
                                                <Download size={14} /> Download
                                            </button>
                                            <button className="btn btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteLocal(b.filename)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

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
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center gap-8">
                                                {statusIcon(l.status)}
                                                <span className={`badge ${l.status === 'SUCCESS' ? 'badge-green' : l.status === 'FAILED' ? 'badge-red' : l.status === 'PARTIAL' ? 'badge-amber' : 'badge-amber'}`}>{l.status}</span>
                                            </div>
                                            <div className="flex gap-4">
                                                <StatusBadge type="local" status={l.localStatus} />
                                                <StatusBadge type="cloud" status={l.cloudStatus} />
                                            </div>
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
