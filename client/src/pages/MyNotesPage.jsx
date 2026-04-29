import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StickyNote, Search, Trash2, Edit2, BookOpen, X } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import 'react-quill-new/dist/quill.snow.css';

export default function MyNotesPage() {
    const toast = useToast();
    const [notes,    setNotes]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [search,   setSearch]   = useState('');
    const [viewNote, setViewNote] = useState(null);
    const [filterCourse, setFilterCourse] = useState('');

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/notes');
                setNotes(data || []);
            } catch {
                toast('Failed to load notes', 'error');
            }
            setLoading(false);
        })();
    }, []);

    const handleDelete = async (noteId, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this note permanently?')) return;
        try {
            await api.delete(`/notes/${noteId}`);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            if (viewNote?.id === noteId) setViewNote(null);
            toast('Note deleted');
        } catch {
            toast('Failed to delete', 'error');
        }
    };

    // Unique courses for filter dropdown
    const uniqueCourses = [...new Map(notes.map(n => [n.courseId, n.course])).entries()]
        .map(([id, course]) => ({ id, ...course }));

    const filtered = notes.filter(n => {
        const q = search.toLowerCase();
        const matchSearch = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.course?.code.toLowerCase().includes(q);
        const matchCourse = !filterCourse || n.courseId === filterCourse;
        return matchSearch && matchCourse;
    });

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Notes</h1>
                    <p className="page-subtitle">Your class summaries and study notes across all courses</p>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '6px 14px', background: 'var(--bg-secondary)', borderRadius: 20 }}>
                    {notes.length} note{notes.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Search + filter bar */}
            <div className="search-bar flex-nowrap mb-24" style={{ gap: 10 }}>
                <div className="search-input-wrap flex-1" style={{ minWidth: 180 }}>
                    <Search className="search-icon" size={15} />
                    <input
                        placeholder="Search notes…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={filterCourse}
                    onChange={e => setFilterCourse(e.target.value)}
                    style={{ flexShrink: 0, minWidth: 180 }}
                >
                    <option value="">All Courses</option>
                    {uniqueCourses.map(c => (
                        <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="loading-wrap"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty py-48">
                    <StickyNote size={52} />
                    {notes.length === 0 ? (
                        <>
                            <p style={{ marginBottom: 12 }}>You have no notes yet.</p>
                            <Link to="/courses" className="btn btn-primary">
                                <BookOpen size={15} /> Browse Courses
                            </Link>
                        </>
                    ) : (
                        <p>No notes match your search.</p>
                    )}
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                    gap: 18,
                }}>
                    {filtered.map(note => (
                        <div
                            key={note.id}
                            onClick={() => setViewNote(note)}
                            style={{
                                background: note.color || '#ffffff',
                                border: '1px solid var(--border)',
                                borderRadius: 14,
                                padding: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                                cursor: 'pointer',
                                transition: 'transform 0.15s',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = '';
                            }}
                        >
                            {/* Course badge */}
                            <div className="flex items-center justify-between">
                                <Link
                                    to={`/courses/${note.courseId}`}
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        fontSize: '0.72rem', fontWeight: 700,
                                        color: 'var(--accent)',
                                        background: 'rgba(var(--accent-rgb,99,102,241),0.1)',
                                        padding: '2px 8px', borderRadius: 20,
                                        textDecoration: 'none',
                                    }}
                                >
                                    {note.course?.code}
                                </Link>
                                {note.topic && (
                                    <span className="badge badge-blue" style={{ fontSize: '0.68rem' }}>{note.topic.title}</span>
                                )}
                            </div>

                            {/* Title */}
                            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                {note.title}
                            </h3>

                            {/* Content preview */}
                            <p style={{
                                fontSize: '0.81rem',
                                color: 'var(--text-secondary)',
                                margin: 0,
                                lineHeight: 1.55,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}>
                                {note.content.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').substring(0, 220)}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between" style={{ marginTop: 'auto', paddingTop: 6 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {new Date(note.updatedAt).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'short', year: 'numeric'
                                    })}
                                </span>
                                <div className="flex gap-6" onClick={e => e.stopPropagation()}>
                                    <Link
                                        to={`/courses/${note.courseId}`}
                                        className="btn-icon"
                                        title="Open in course"
                                        style={{ color: 'var(--accent)' }}
                                    >
                                        <Edit2 size={13} />
                                    </Link>
                                    <button
                                        className="btn-icon"
                                        title="Delete"
                                        style={{ color: 'var(--danger)' }}
                                        onClick={e => handleDelete(note.id, e)}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Full viewer modal */}
            {viewNote && (
                <div className="modal-backdrop" onClick={() => setViewNote(null)} style={{ zIndex: 9999 }}>
                    <div
                        className="modal"
                        style={{ maxWidth: 720, width: '95%', background: viewNote.color || '#fff' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                            <div style={{ flex: 1 }}>
                                <span className="modal-title">{viewNote.title}</span>
                                <div className="flex gap-8 mt-4">
                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                                        {viewNote.course?.code} — {viewNote.course?.title}
                                    </span>
                                    {viewNote.topic && (
                                        <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{viewNote.topic.title}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-8">
                                <Link
                                    to={`/courses/${viewNote.courseId}`}
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setViewNote(null)}
                                >
                                    <Edit2 size={13} /> Edit in Course
                                </Link>
                                <button className="btn-icon" onClick={() => setViewNote(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div
                            className="modal-body ql-editor"
                            style={{ lineHeight: 1.8, fontSize: '0.92rem', color: 'var(--text-primary)', paddingTop: 20 }}
                            dangerouslySetInnerHTML={{ __html: viewNote.content }}
                        />
                        <div className="modal-footer" style={{ borderTop: '1px solid rgba(0,0,0,0.08)', justifyContent: 'flex-start' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Last updated: {new Date(viewNote.updatedAt).toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
