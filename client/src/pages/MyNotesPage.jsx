import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { StickyNote, Search, Trash2, Edit2, BookOpen, X, Plus, Eye, PenLine, Save } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = lazy(() => import('react-quill-new'));

const NOTE_COLORS = [
    { label: 'White',  value: '#ffffff' },
    { label: 'Yellow', value: '#fef9c3' },
    { label: 'Blue',   value: '#dbeafe' },
    { label: 'Green',  value: '#dcfce7' },
    { label: 'Pink',   value: '#fce7f3' },
    { label: 'Purple', value: '#ede9fe' },
    { label: 'Orange', value: '#ffedd5' },
];

const EMPTY_FORM = { title: '', content: '', color: '#ffffff', courseId: '', topicId: '' };

export default function MyNotesPage() {
    const toast = useToast();
    const [notes,         setNotes]         = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [search,        setSearch]        = useState('');
    const [viewNote,      setViewNote]      = useState(null);
    const [filterCourse,  setFilterCourse]  = useState('');

    // Create / Edit modal
    const [modalOpen,     setModalOpen]     = useState(false);
    const [editingId,     setEditingId]     = useState(null);
    const [form,          setForm]          = useState(EMPTY_FORM);
    const [saving,        setSaving]        = useState(false);
    const [preview,       setPreview]       = useState(false);

    // Courses & topics for the form
    const [courses,       setCourses]       = useState([]);
    const [topics,        setTopics]        = useState([]);
    const [loadingTopics, setLoadingTopics] = useState(false);

    /* ── Load all notes ── */
    const loadNotes = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/notes');
            setNotes(data || []);
        } catch {
            toast('Failed to load notes', 'error');
        }
        setLoading(false);
    };

    /* ── Load enrolled courses for the picker ── */
    const loadCourses = async () => {
        try {
            const { data } = await api.get('/courses', { params: { limit: 200 } });
            setCourses(data.data || []);
        } catch { /* silently fail */ }
    };

    useEffect(() => {
        loadNotes();
        loadCourses();
    }, []);

    /* ── Load topics when a course is chosen ── */
    useEffect(() => {
        if (!form.courseId) { setTopics([]); return; }
        (async () => {
            setLoadingTopics(true);
            try {
                const { data } = await api.get(`/courses/${form.courseId}`);
                setTopics(data.topics || []);
            } catch { setTopics([]); }
            setLoadingTopics(false);
        })();
    }, [form.courseId]);

    /* ── Open modal for new note ── */
    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setPreview(false);
        setModalOpen(true);
    };

    /* ── Open modal for editing ── */
    const openEdit = (note, e) => {
        e?.stopPropagation();
        setEditingId(note.id);
        setForm({
            title:    note.title,
            content:  note.content,
            color:    note.color || '#ffffff',
            courseId: note.courseId,
            topicId:  note.topicId || '',
        });
        setPreview(false);
        setModalOpen(true);
        setViewNote(null);
    };

    /* ── Save (create or update) ── */
    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.courseId) {
            toast('Title and course are required', 'error');
            return;
        }
        const isEmpty = !form.content.trim() || form.content === '<p><br></p>';
        if (isEmpty) { toast('Note content cannot be empty', 'error'); return; }

        setSaving(true);
        try {
            if (editingId) {
                const { data } = await api.put(`/notes/${editingId}`, form);
                setNotes(prev => prev.map(n => n.id === editingId ? data : n));
                toast('Note updated ✅');
            } else {
                const { data } = await api.post('/notes', form);
                setNotes(prev => [data, ...prev]);
                toast('Note saved ✅');
            }
            setModalOpen(false);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to save note', 'error');
        }
        setSaving(false);
    };

    /* ── Delete ── */
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

    /* ── Derived state ── */
    const uniqueCourses = [...new Map(notes.map(n => [n.courseId, n.course])).entries()]
        .map(([id, course]) => ({ id, ...course }));

    const filtered = notes.filter(n => {
        const q = search.toLowerCase();
        const matchSearch = !q
            || n.title.toLowerCase().includes(q)
            || n.content.toLowerCase().includes(q)
            || n.course?.code?.toLowerCase().includes(q);
        const matchCourse = !filterCourse || n.courseId === filterCourse;
        return matchSearch && matchCourse;
    });

    const strip = (html) =>
        html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').substring(0, 220);

    return (
        <div className="animate-in">
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">My Notes</h1>
                    <p className="page-subtitle">Your class summaries and study notes across all courses</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '6px 14px', background: 'var(--bg-secondary)', borderRadius: 20 }}>
                        {notes.length} note{notes.length !== 1 ? 's' : ''}
                    </span>
                    <button className="btn btn-primary" onClick={openCreate}>
                        <Plus size={15} /> New Note
                    </button>
                </div>
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

            {/* Notes grid */}
            {loading ? (
                <div className="loading-wrap"><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="empty py-48">
                    <StickyNote size={52} />
                    {notes.length === 0 ? (
                        <>
                            <p style={{ marginBottom: 12 }}>You have no notes yet.</p>
                            <button className="btn btn-primary" onClick={openCreate}>
                                <Plus size={15} /> Create Your First Note
                            </button>
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
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
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
                                {strip(note.content)}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between" style={{ marginTop: 'auto', paddingTop: 6 }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {new Date(note.updatedAt).toLocaleDateString('en-GB', {
                                        day: 'numeric', month: 'short', year: 'numeric'
                                    })}
                                </span>
                                <div className="flex gap-6" onClick={e => e.stopPropagation()}>
                                    <button
                                        className="btn-icon"
                                        title="Edit note"
                                        style={{ color: 'var(--accent)' }}
                                        onClick={e => openEdit(note, e)}
                                    >
                                        <Edit2 size={13} />
                                    </button>
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

            {/* ── Create / Edit Modal ── */}
            {modalOpen && (
                <div className="modal-backdrop" onClick={() => setModalOpen(false)} style={{ zIndex: 9998 }}>
                    <div
                        className="modal"
                        style={{ maxWidth: 760, width: '96%', background: form.color || '#fff' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                            <span className="modal-title">
                                {editingId ? '✏️ Edit Note' : '📝 New Note'}
                            </span>
                            <div className="flex gap-8">
                                <button
                                    type="button"
                                    className={`btn btn-sm ${preview ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setPreview(v => !v)}
                                >
                                    {preview ? <PenLine size={13} /> : <Eye size={13} />}
                                    {preview ? 'Edit' : 'Preview'}
                                </button>
                                <button className="btn-icon" onClick={() => setModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                                {/* Title + colour row */}
                                <div className="flex gap-12" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                                        <label>Title <span style={{ color: 'red' }}>*</span></label>
                                        <input
                                            required
                                            value={form.title}
                                            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="e.g. Lecture 3 Summary"
                                            style={{ fontSize: '1rem', fontWeight: 500 }}
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label>Colour</label>
                                        <div className="flex gap-6" style={{ paddingTop: 6 }}>
                                            {NOTE_COLORS.map(c => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    title={c.label}
                                                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                                                    style={{
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        background: c.value,
                                                        border: form.color === c.value
                                                            ? '2.5px solid var(--accent)'
                                                            : '2px solid var(--border)',
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.15s',
                                                        transform: form.color === c.value ? 'scale(1.25)' : 'scale(1)',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Course picker */}
                                <div className="form-row" style={{ gap: 12 }}>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Course <span style={{ color: 'red' }}>*</span></label>
                                        <select
                                            required
                                            value={form.courseId}
                                            onChange={e => setForm(f => ({ ...f, courseId: e.target.value, topicId: '' }))}
                                        >
                                            <option value="">— Select a course —</option>
                                            {courses.map(c => (
                                                <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ''}{c.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Linked Topic <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                                        <select
                                            value={form.topicId}
                                            onChange={e => setForm(f => ({ ...f, topicId: e.target.value }))}
                                            disabled={!form.courseId || loadingTopics}
                                        >
                                            <option value="">— No specific topic —</option>
                                            {topics.map(t => (
                                                <option key={t.id} value={t.id}>{t.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Editor / Preview */}
                                {preview ? (
                                    <div
                                        className="ql-editor"
                                        style={{
                                            minHeight: 220, padding: 16,
                                            background: form.color || '#ffffff',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8, lineHeight: 1.75,
                                            fontSize: '0.92rem', color: 'var(--text-primary)',
                                        }}
                                        dangerouslySetInnerHTML={{ __html: form.content }}
                                    />
                                ) : (
                                    <div className="form-group quill-container" style={{ marginBottom: 0 }}>
                                        <label>Content <span style={{ color: 'red' }}>*</span></label>
                                        <Suspense fallback={<div className="loading-wrap" style={{ minHeight: 140 }}><div className="spinner" /></div>}>
                                            <ReactQuill
                                                theme="snow"
                                                value={form.content}
                                                onChange={val => setForm(f => ({ ...f, content: val }))}
                                                placeholder="Write your class summary, key points, or study notes here…"
                                                style={{ background: '#fff' }}
                                            />
                                        </Suspense>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving || !form.title.trim() || !form.courseId || !form.content.trim() || form.content === '<p><br></p>'}
                                >
                                    <Save size={14} />
                                    {saving ? 'Saving…' : editingId ? 'Update Note' : 'Save Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Full viewer modal ── */}
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
                                <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={e => openEdit(viewNote, e)}
                                >
                                    <Edit2 size={13} /> Edit
                                </button>
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
