import { useEffect, useState, useRef } from 'react';
import { Cloud, Upload, Download, Trash2, File, FileText, Search, Loader, Clock, HardDrive } from 'lucide-react';
import api, { SERVER_URL } from '../api';
import { useToast } from '../context/ToastContext';

export default function StudentVaultPage() {
    const toast = useToast();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [search, setSearch] = useState('');
    const fileInputRef = useRef(null);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/student-files');
            setFiles(data.data || []);
        } catch (err) {
            toast('Failed to load vault files', 'error');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post('/student-files', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast('File uploaded to your vault');
            loadFiles();
        } catch (err) {
            toast(err.response?.data?.error || 'Upload failed', 'error');
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to delete "${name}" from your vault?`)) return;
        try {
            await api.delete(`/student-files/${id}`);
            toast('File deleted');
            setFiles(prev => prev.filter(f => f.id !== id));
        } catch (err) {
            toast('Failed to delete file', 'error');
        }
    };

    const fmtSize = (bytes) => {
        if (!bytes) return 'N/A';
        const kb = bytes / 1024;
        if (kb < 1024) return `${Math.round(kb)} KB`;
        return `${(kb / 1024).toFixed(1)} MB`;
    };

    const filtered = files.filter(f => 
        f.filename.toLowerCase().includes(search.toLowerCase())
    );

    const getFileIcon = (mimeType) => {
        if (!mimeType) return <File size={24} />;
        const mime = mimeType.toLowerCase();
        if (mime.includes('pdf')) return <FileText size={24} style={{ color: '#ef4444' }} />;
        if (mime.includes('image')) return <File size={24} style={{ color: '#3b82f6' }} />;
        if (mime.includes('word') || mime.includes('officedocument') || mime.includes('text')) return <FileText size={24} style={{ color: '#2563eb' }} />;
        if (mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('csv')) return <FileText size={24} style={{ color: '#10b981' }} />;
        if (mime.includes('zip') || mime.includes('rar') || mime.includes('7z')) return <File size={24} style={{ color: '#f59e0b' }} />;
        return <File size={24} />;
    };

    return (
        <div className="animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Personal Vault</h1>
                    <p className="page-subtitle">Securely store your drafts, papers, and personal project files.</p>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? <Loader className="animate-spin" size={16} /> : <Upload size={16} />}
                    {uploading ? 'Uploading...' : 'Upload File'}
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleUpload} 
                />
            </div>

            <div className="search-bar">
                <div className="search-input-wrap flex-1">
                    <Search className="search-icon" size={16} />
                    <input
                        placeholder="Search your vault..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <HardDrive size={16} />
                    <span>{files.length} Files</span>
                </div>
            </div>

            {loading ? (
                <div className="loading-wrap"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty" style={{ minHeight: '400px' }}>
                    {search ? (
                        <>
                            <Search size={48} style={{ opacity: 0.2 }} />
                            <p>No files matching "{search}"</p>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear search</button>
                        </>
                    ) : (
                        <>
                            <Cloud size={64} style={{ opacity: 0.1, marginBottom: 20 }} />
                            <h3>Your vault is empty</h3>
                            <p style={{ maxWidth: 300, margin: '10px auto' }}>Upload your current work-in-progress files here to keep them safe and accessible from any device.</p>
                            <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
                                Create first upload
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Size</th>
                                <th>Uploaded</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(file => (
                                <tr key={file.id}>
                                    <td>
                                        <div className="flex items-center gap-12">
                                            <div style={{ 
                                                width: 40, height: 40, borderRadius: 8, background: 'var(--bg-secondary)', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                            }}>
                                                {getFileIcon(file.mimeType)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{file.filename}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{file.mimeType || 'Unknown Type'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ fontSize: '0.85rem' }}>{fmtSize(file.fileSize)}</span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-4 text-muted" style={{ fontSize: '0.85rem' }}>
                                            <Clock size={14} />
                                            {new Date(file.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex gap-8 justify-end">
                                            <a 
                                                href={`${SERVER_URL}${file.url}`} 
                                                download={file.filename}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-secondary btn-sm btn-icon" 
                                                title="Download"
                                            >
                                                <Download size={14} />
                                            </a>
                                            <button 
                                                className="btn btn-danger btn-sm btn-icon" 
                                                onClick={() => handleDelete(file.id, file.filename)}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
