import { useEffect, useState } from 'react';
import { Search, Play, FileText, Download, ExternalLink, Filter, GraduationCap, X } from 'lucide-react';
import api, { SERVER_URL } from '../api';
import { useToast } from '../context/ToastContext';

export default function ClassMaterialsPage() {
    const toast = useToast();
    const [materials, setMaterials] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCourse, setFilterCourse] = useState('');
    const [filterType, setFilterType] = useState('');
    const [search, setSearch] = useState('');
    const [viewingMaterial, setViewingMaterial] = useState(null);
    const [restrictionError, setRestrictionError] = useState(null);

    const load = async () => {
        setLoading(true);
        setRestrictionError(null);
        try {
            const [{ data }, { data: cData }] = await Promise.all([
                api.get('/materials', { params: { courseId: filterCourse, type: filterType } }),
                api.get('/courses')
            ]);
            setMaterials(data.data);
            setCourses(cData.data || []);
        } catch (err) {
            if (err.response?.status === 403) {
                setRestrictionError(err.response.data.error || 'Access restricted during exam period.');
            } else {
                toast('Failed to load materials', 'error');
            }
            setMaterials([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, [filterCourse, filterType]);

    const filtered = materials.filter(m =>
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.course.code?.toLowerCase().includes(search.toLowerCase())
    );

    const fmtSize = (bytes) => {
        if (!bytes) return 'N/A';
        const kb = bytes / 1024;
        if (kb < 1024) return `${Math.round(kb)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Class Library</h1>
                    <p className="page-subtitle">Access your class recordings and reading materials</p>
                </div>
            </div>

            <div className="search-bar">
                <div className="search-input-wrap flex-260">
                    <Search className="search-icon" size={16} />
                    <input
                        placeholder="Search materials…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={filterCourse}
                    onChange={e => setFilterCourse(e.target.value)}
                    style={{ width: 220 }}
                >
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.title}</option>)}
                </select>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    style={{ width: 160 }}
                >
                    <option value="">All Formats</option>
                    <option value="VIDEO">Videos</option>
                    <option value="READING">Readings (PDF)</option>
                    <option value="SLIDE">Slides (PPTX)</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-wrap"><div className="spinner" /></div>
            ) : restrictionError ? (
                <div className="empty" style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ background: 'var(--danger)', color: 'white', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <GraduationCap size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Library Locked</h2>
                    <p style={{ color: 'var(--danger)', maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
                        {restrictionError}
                    </p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="empty">
                    <GraduationCap size={48} />
                    <p>No materials found for your selection</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {filtered.map(m => (
                        <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                            <div style={{
                                height: 160,
                                background: m.type === 'VIDEO' ? 'var(--text-primary)' : 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative'
                            }}>
                                {m.type === 'VIDEO' ? (
                                    <div style={{ color: '#fff', textAlign: 'center' }}>
                                        <Play size={48} />
                                        <div style={{ fontSize: '0.7rem', marginTop: 8, opacity: 0.6 }}>Video Recording</div>
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                                        <FileText size={48} />
                                        <div style={{ fontSize: '0.7rem', marginTop: 8 }}>{m.type === 'READING' ? 'PDF Document' : 'Slide Deck'}</div>
                                    </div>
                                )}
                                <div style={{
                                    position: 'absolute',
                                    top: 12,
                                    left: 12,
                                    background: 'rgba(255,255,255,0.9)',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    fontFamily: 'monospace'
                                }}>
                                    {m.course.code}
                                </div>
                            </div>

                            <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4, lineHeight: 1.4 }}>{m.title}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12, flex: 1 }}>
                                    {m.description || 'No description provided.'}
                                </p>

                                <div className="flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {m.isExternal ? 'Cloud Link' : fmtSize(m.fileSize)}
                                    </div>
                                    <div className="flex gap-8">
                                        {m.isExternal ? (
                                            <button onClick={() => setViewingMaterial(m)} className="btn btn-secondary btn-sm">
                                                <ExternalLink size={14} /> View
                                            </button>
                                        ) : (
                                            <>
                                                {m.type === 'VIDEO' && (
                                                    <button onClick={() => setViewingMaterial(m)} className="btn btn-primary btn-sm">
                                                        <Play size={14} /> Watch
                                                    </button>
                                                )}
                                                {m.type === 'READING' && (
                                                    <button onClick={() => setViewingMaterial(m)} className="btn btn-secondary btn-sm">
                                                        <FileText size={14} /> Read
                                                    </button>
                                                )}
                                                <a href={m.url.startsWith('http') ? m.url : `${SERVER_URL}${m.url}`} download className="btn btn-secondary btn-sm" title="Download for offline Use">
                                                    <Download size={14} />
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {viewingMaterial && (
                <div className="modal-backdrop" onClick={() => setViewingMaterial(null)}>
                    <div className="modal" style={{ maxWidth: '900px', width: '95%' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">{viewingMaterial.title}</span>
                            <div className="flex gap-8">
                                {!viewingMaterial.isExternal && (
                                    <a href={viewingMaterial.url.startsWith('http') ? viewingMaterial.url : `${SERVER_URL}${viewingMaterial.url}`} download className="btn btn-secondary btn-sm">
                                        <Download size={14} />
                                    </a>
                                )}
                                <button className="btn-icon" onClick={() => setViewingMaterial(null)}><X size={20} /></button>
                            </div>
                        </div>
                        <div className="modal-body" style={{ padding: 0, background: '#000', minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {viewingMaterial.type === 'VIDEO' ? (
                                <video
                                    src={viewingMaterial.url.startsWith('http') ? viewingMaterial.url : `${SERVER_URL}${viewingMaterial.url}`}
                                    controls
                                    autoPlay
                                    style={{ width: '100%', maxHeight: '80vh' }}
                                />
                            ) : viewingMaterial.type === 'READING' ? (
                                <iframe
                                    src={viewingMaterial.url.startsWith('http') ? viewingMaterial.url : `${SERVER_URL}${viewingMaterial.url}`}
                                    style={{ width: '100%', height: '80vh', border: 'none' }}
                                    title={viewingMaterial.title}
                                />
                            ) : (
                                <div style={{ padding: 40, textAlign: 'center', color: '#fff' }}>
                                    <p>This file type cannot be previewed directly.</p>
                                    <a href={viewingMaterial.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Open in New Tab</a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
