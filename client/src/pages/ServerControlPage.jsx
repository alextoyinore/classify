import { useEffect, useState, useRef } from 'react';
import { Server, Play, Square, RefreshCw } from 'lucide-react';

const AGENT_URL = import.meta.env.VITE_AGENT_URL || 'http://localhost:9001';

export default function ServerControlPage() {
    const [running, setRunning] = useState(false);
    const [managed, setManaged] = useState(false);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [port, setPort] = useState(5000);
    const logsRef = useRef(null);

    const addLog = (msg, type = 'info') => {
        const time = new Date().toLocaleTimeString();
        setLogs(l => [...l.slice(-99), { time, msg, type }]);
    };

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${AGENT_URL}/status`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('classify_token')}` },
            });
            const data = await res.json();
            setRunning(data.running);
            setManaged(data.managed);
            if (data.port) setPort(data.port);
        } catch {
            addLog('Cannot reach agent on port 9001', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { fetchStatus(); const iv = setInterval(fetchStatus, 5000); return () => clearInterval(iv); }, []);

    useEffect(() => { logsRef.current?.scrollTo(0, logsRef.current.scrollHeight); }, [logs]);

    const doAction = async (action) => {
        setActing(true);
        addLog(`Sending ${action} signal…`, 'info');
        try {
            const res = await fetch(`${AGENT_URL}/${action}`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('classify_token')}` },
            });
            const data = await res.json();
            addLog(data.message || `Server ${action} successful`, 'success');
            setTimeout(fetchStatus, 1500);
        } catch {
            addLog(`Failed to ${action} server`, 'error');
        }
        setActing(false);
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Server Control</h1>
                    <p className="page-subtitle">Start, stop and monitor the Classify API server</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchStatus} disabled={loading}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Status card */}
            <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                <div style={{
                    width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: running ? 'rgba(0,201,167,0.1)' : 'var(--danger-dim)',
                    border: `3px solid ${running ? 'var(--accent)' : 'var(--danger)'}`,
                    position: 'relative',
                }}>
                    <Server size={36} color={running ? 'var(--accent)' : 'var(--danger)'} />
                    <div style={{
                        position: 'absolute', bottom: 4, right: 4, width: 14, height: 14,
                        borderRadius: '50%', background: running ? 'var(--accent)' : 'var(--danger)',
                        border: '2px solid var(--bg-card)',
                        animation: running ? 'pulse 2s infinite' : 'none',
                    }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4 }}>
                        Server is {loading ? 'checking…' : !running ? 'Stopped' : managed ? 'Running' : 'External'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {running
                            ? (managed ? `API available at port ${port} (Managed)` : 'API is online (Externally Managed)')
                            : 'API is offline — students cannot connect'}
                    </div>
                </div>
                <div className="flex gap-12">
                    <button className="btn btn-primary" onClick={() => doAction('start')} disabled={acting || running}>
                        <Play size={16} /> Start
                    </button>
                    <button className="btn btn-danger" onClick={() => doAction('stop')} disabled={acting || !running}>
                        <Square size={16} /> Stop
                    </button>
                </div>
            </div>

            {/* Console log */}
            <div className="card">
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Activity Log</span>
                    <button className="btn btn-secondary btn-sm" onClick={() => setLogs([])}>Clear</button>
                </div>
                <div ref={logsRef} style={{
                    background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', padding: 16,
                    fontFamily: 'monospace', fontSize: '0.82rem', height: 260, overflowY: 'auto',
                    border: '1px solid var(--border)',
                }}>
                    {logs.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>No activity yet…</span>
                    ) : (
                        logs.map((l, i) => (
                            <div key={i} style={{ marginBottom: 4, color: l.type === 'error' ? 'var(--danger)' : l.type === 'success' ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>{l.time}</span>
                                {l.msg}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
    );
}
