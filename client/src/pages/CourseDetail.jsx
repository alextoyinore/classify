import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Users, UserCheck, BookOpen, Trash2, Edit2, Plus, Check, X, StickyNote, Eye, PenLine, Download } from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api, { SERVER_URL } from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function CourseDetail() {
    const { id } = useParams();
    const toast = useToast();
    const { isAdmin, isInstructor, user } = useAuth();
    const [course, setCourse] = useState(null);
    const [students, setStudents] = useState([]);
    const [tab, setTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [matricList, setMatricList] = useState('');
    const [enrolling, setEnrolling] = useState(false);
    const [session, setSession] = useState(new Date().getFullYear() + '/' + (new Date().getFullYear() + 1));
    const [semester, setSemester] = useState('FIRST');
    const [allDepartments, setAllDepartments] = useState([]);
    const [editLevels, setEditLevels] = useState([]);
    const [editDepts, setEditDepts] = useState([]);
    const [editSemesters, setEditSemesters] = useState([]);
    const [savingAssignments, setSavingAssignments] = useState(false);

    const [assignInstructorModal, setAssignInstructorModal] = useState(false);
    const [availableInstructors, setAvailableInstructors] = useState([]);
    const [selectedInstructorId, setSelectedInstructorId] = useState('');
    const [assigningInstructor, setAssigningInstructor] = useState(false);

    const [topics, setTopics] = useState([]);
    const [topicForm, setTopicForm] = useState({ title: '', description: '' });
    const [savingTopic, setSavingTopic] = useState(false);
    const [editingTopicId, setEditingTopicId] = useState(null);

    const [resources, setResources] = useState([]);
    const [loadingResources, setLoadingResources] = useState(false);
    const [resourceModal, setResourceModal] = useState(null);
    const [resourceForm, setResourceForm] = useState({ title: '', description: '', type: 'VIDEO', isExternal: false, url: '' });
    const [uploadingFile, setUploadingFile] = useState(null);
    const [savingResource, setSavingResource] = useState(false);
    const [viewingMaterial, setViewingMaterial] = useState(null);

    // ── My Notes (student only) ──────────────────────────────────────────
    const [notes, setNotes] = useState([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [noteForm, setNoteForm] = useState({ title: '', content: '', color: '#ffffff', topicId: '' });
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [savingNote, setSavingNote] = useState(false);
    const [notePreview, setNotePreview] = useState(false);
    const [viewNote, setViewNote] = useState(null); // full-screen viewer

    const NOTE_COLORS = [
        { label: 'White', value: '#ffffff' },
        { label: 'Yellow', value: '#fef9c3' },
        { label: 'Blue', value: '#dbeafe' },
        { label: 'Green', value: '#dcfce7' },
        { label: 'Pink', value: '#fce7f3' },
        { label: 'Purple', value: '#ede9fe' },
        { label: 'Orange', value: '#ffedd5' },
    ];

    useEffect(() => {
        (async () => {
            try {
                const [cRes, sRes, dRes, curRes] = await Promise.all([
                    api.get(`/courses/${id}`),
                    api.get(`/courses/${id}/students`),
                    isAdmin || isInstructor ? api.get(`/departments`) : Promise.resolve({ data: [] }),
                    api.get('/sessions/current')
                ]);
                setCourse(cRes.data);
                setTopics(cRes.data.topics || []);
                setStudents(sRes.data || []);
                if (isAdmin || isInstructor) {
                    setAllDepartments(dRes.data || []);
                    setEditLevels(cRes.data.levels || []);
                    setEditDepts(cRes.data.departments?.map(d => d.id) || []);
                    setEditSemesters(cRes.data.semesters || []);
                }
                if (curRes.data) {
                    setSession(curRes.data.session?.title || session);
                    setSemester(curRes.data.name || semester);
                }
                loadResources();
                if (user?.role === 'STUDENT') loadNotes();
            } catch { }
            setLoading(false);
        })();
    }, [id]);

    const loadResources = async () => {
        setLoadingResources(true);
        try {
            const { data } = await api.get('/materials', { params: { courseId: id } });
            setResources(data.data || []);
        } catch { }
        setLoadingResources(false);
    };

    const loadNotes = async () => {
        setLoadingNotes(true);
        try {
            const { data } = await api.get('/notes', { params: { courseId: id } });
            setNotes(data || []);
        } catch { }
        setLoadingNotes(false);
    };

    const handleSaveNote = async (e) => {
        e.preventDefault();
        if (!noteForm.title.trim() || !noteForm.content.trim()) return;
        setSavingNote(true);
        try {
            if (editingNoteId) {
                const { data } = await api.put(`/notes/${editingNoteId}`, noteForm);
                setNotes(prev => prev.map(n => n.id === editingNoteId ? data : n));
                toast('Note updated ✅');
            } else {
                const { data } = await api.post('/notes', { ...noteForm, courseId: id });
                setNotes(prev => [data, ...prev]);
                toast('Note saved ✅');
            }
            setNoteForm({ title: '', content: '', color: '#ffffff', topicId: '' });
            setEditingNoteId(null);
            setNotePreview(false);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to save note', 'error');
        }
        setSavingNote(false);
    };

    const handleDeleteNote = async (noteId) => {
        if (!window.confirm('Delete this note?')) return;
        try {
            await api.delete(`/notes/${noteId}`);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            toast('Note deleted');
        } catch { toast('Failed to delete note', 'error'); }
    };

    const startEditNote = (note) => {
        setEditingNoteId(note.id);
        setNoteForm({ title: note.title, content: note.content, color: note.color || '#ffffff', topicId: note.topicId || '' });
        setNotePreview(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const loadInstructorsForAssignment = async () => {
        try {
            const { data } = await api.get('/instructors?limit=1000');
            setAvailableInstructors(data.data || []);
        } catch { }
    };

    useEffect(() => {
        if (assignInstructorModal && availableInstructors.length === 0) {
            loadInstructorsForAssignment();
        }
    }, [assignInstructorModal]);

    const handleAssignInstructor = async (e) => {
        e.preventDefault();
        if (!selectedInstructorId) return;
        setAssigningInstructor(true);
        try {
            await api.post('/instructors/assign', { instructorId: selectedInstructorId, courseId: id, isPrimary: course.instructors.length === 0 });
            toast('Instructor assigned successfully');
            setAssignInstructorModal(false);
            const { data } = await api.get(`/courses/${id}`);
            setCourse(data);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to assign instructor', 'error');
        }
        setAssigningInstructor(false);
    };

    const handleEnroll = async (e) => {
        e.preventDefault();
        if (!matricList.trim()) return;
        setEnrolling(true);
        try {
            const matrics = matricList.split(/[\n,]/).map(m => m.trim()).filter(Boolean);
            const { data } = await api.post(`/courses/${id}/enroll`, { matrics, session, semester });
            toast(`Enrolled ${data.enrolled} students successfully`);
            setMatricList('');
            const { data: sData } = await api.get(`/courses/${id}/students`);
            setStudents(sData || []);
        } catch (err) {
            toast(err.response?.data?.error || 'Enrollment failed', 'error');
        }
        setEnrolling(false);
    };

    const handleAutoEnroll = async () => {
        if (!window.confirm(`Auto-enroll all students matching this course's assigned departments and levels for ${session} (${semester})?`)) return;
        setEnrolling(true);
        try {
            const { data } = await api.post(`/courses/${id}/auto-enroll`, { session, semester });
            toast(`Auto-enrolled ${data.enrolled} students successfully`);
            const { data: sData } = await api.get(`/courses/${id}/students`);
            setStudents(sData || []);
        } catch (err) {
            toast(err.response?.data?.error || 'Auto-enrollment failed', 'error');
        }
        setEnrolling(false);
    };

    const handleUnenrollStudent = async (studentId, studentName) => {
        if (!window.confirm(`Are you sure you want to unenroll ${studentName} from this course?`)) return;
        try {
            await api.delete(`/courses/${id}/enroll/${studentId}`);
            toast(`${studentName} unenrolled successfully`);
            setStudents(students.filter(s => s.student.id !== studentId));
        } catch (err) {
            toast(err.response?.data?.error || 'Unenrollment failed', 'error');
        }
    };

    const handleUpdateAssignments = async (e) => {
        e.preventDefault();
        setSavingAssignments(true);
        try {
            const { data } = await api.put(`/courses/${id}`, {
                levels: editLevels,
                departmentIds: editDepts,
                semesters: editSemesters
            });
            setCourse(data.course);
            toast('Course assignments updated');
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to update', 'error');
        }
        setSavingAssignments(false);
    };

    const handleSaveTopic = async (e) => {
        e.preventDefault();
        if (!topicForm.title.trim()) return;
        setSavingTopic(true);
        try {
            if (editingTopicId) {
                const { data } = await api.put(`/courses/${id}/topics/${editingTopicId}`, topicForm);
                setTopics(topics.map(t => t.id === editingTopicId ? data : t));
                toast('Topic updated');
            } else {
                const { data } = await api.post(`/courses/${id}/topics`, topicForm);
                setTopics([...topics, data]);
                toast('Topic added');
            }
            setTopicForm({ title: '', description: '' });
            setEditingTopicId(null);
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to save topic', 'error');
        }
        setSavingTopic(false);
    };

    const handleDeleteTopic = async (topicId) => {
        if (!window.confirm('Are you sure you want to delete this topic?')) return;
        try {
            await api.delete(`/courses/${id}/topics/${topicId}`);
            setTopics(topics.filter(t => t.id !== topicId));
            toast('Topic deleted');
        } catch (err) {
            toast('Failed to delete topic', 'error');
        }
    };

    const handleSaveResource = async (e) => {
        e.preventDefault();
        setSavingResource(true);
        try {
            const formData = new FormData();
            formData.append('title', resourceForm.title);
            formData.append('description', resourceForm.description);
            formData.append('type', resourceForm.type);
            formData.append('isExternal', resourceForm.isExternal);
            formData.append('courseId', id);
            formData.append('semesterId', course.semesterId || (course.semesters?.[0] === 'FIRST' ? 'first_id_placeholder' : 'second_id_placeholder')); // Fallback
            // Use session/semester if id is not available
            if (resourceForm.isExternal) {
                formData.append('url', resourceForm.url);
            } else if (uploadingFile) {
                formData.append('file', uploadingFile);
            }

            // Real semester mapping
            const currentSemester = await api.get('/sessions/current');
            if (currentSemester.data) {
                formData.set('semesterId', currentSemester.data.id);
            }

            await api.post('/materials', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast('Resource added successfully');
            setResourceModal(null);
            loadResources();
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to upload resource', 'error');
        }
        setSavingResource(false);
    };

    const handleDeleteResource = async (rid) => {
        if (!window.confirm('Delete this resource?')) return;
        try {
            await api.delete(`/materials/${rid}`);
            toast('Resource deleted');
            loadResources();
        } catch (err) {
            toast('Delete failed', 'error');
        }
    };

    if (loading) return <div className="loading-wrap"><div className="spinner" /></div>;
    if (!course) return <div className="empty"><p>Course not found.</p></div>;

    return (
        <div>
            <Link to="/courses" className="btn btn-secondary btn-sm" style={{ marginBottom: 20 }}>
                <ArrowLeft size={14} /> Back to Courses
            </Link>

            <div className="card" style={{ marginBottom: 24 }}>
                <div className="flex items-center gap-12 flex-wrap">
                    <div className="stat-icon" style={{ background: 'var(--info-dim)', color: 'var(--info)', width: 52, height: 52 }}>
                        <BookOpen size={24} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>{course.code}</div>
                        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>{course.title}</h1>
                        <div className="flex gap-8 flex-wrap" style={{ gap: 8 }}>
                            <span className="badge badge-blue">{course.levels?.length ? course.levels.map(l => l + 'L').join(', ') : 'No Levels'}</span>
                            <span className="badge badge-purple">{course.semesters?.length ? course.semesters.join(', ') : 'No Semesters'}</span>
                            <span className="badge badge-muted">
                                {isAdmin || isInstructor
                                    ? (course.departments?.length ? course.departments.map(d => d.name).join(', ') : 'No Departments')
                                    : (course.departments?.find(d => d.id === (user?.profile?.departmentId || user?.profile?.department?.id || user?.student?.departmentId))?.name || 'N/A')
                                }
                            </span>
                            <span className="badge badge-amber">{course.creditUnits || 'N/A'} Credits</span>
                            <span className={`badge ${course.isActive ? 'badge-green' : 'badge-red'}`}>{course.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{students.length}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Enrolled</div>
                    </div>
                </div>
                {course.description && <p style={{ marginTop: 16, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{course.description}</p>}
            </div>

            <div className="tabs">
                {[
                    'overview',
                    'curriculum',
                    'resources',
                    'students',
                    (isAdmin || isInstructor) && 'enroll',
                    (isAdmin || isInstructor) && 'assignments',
                    user?.role === 'STUDENT' && 'notes',
                ].filter(Boolean).map(t => (
                    <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                        {t === 'overview' ? 'Instructors'
                            : t === 'curriculum' ? `Curriculum (${topics.length})`
                                : t === 'resources' ? `Resources (${resources.length})`
                                    : t === 'students' ? `Students (${students.length})`
                                        : t === 'enroll' ? 'Enroll Students'
                                            : t === 'notes' ? `My Notes (${notes.length})`
                                                : 'Assignments'}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="card">
                    <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontWeight: 700 }}>Instructors</h3>
                        {isAdmin && (
                            <button className="btn btn-primary btn-sm" onClick={() => setAssignInstructorModal(true)}>
                                <Plus size={14} /> Assign Instructor
                            </button>
                        )}
                    </div>
                    {course.instructors?.length > 0 ? (
                        <div>
                            {course.instructors.map(ci => (
                                <div key={ci.id} className="flex items-center gap-12" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                    <div className="avatar" style={{ width: 36, height: 36, fontSize: '0.75rem' }}>
                                        {ci.instructor?.firstName?.[0]}{ci.instructor?.lastName?.[0]}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{ci.instructor?.firstName} {ci.instructor?.lastName}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{ci.instructor?.staffId}</div>
                                    </div>
                                    {ci.isPrimary && <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Primary</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty"><UserCheck size={48} /><p>No instructors assigned</p></div>
                    )}
                </div>
            )}

            {tab === 'students' && (
                students.length === 0 ? (
                    <div className="empty"><Users size={48} /><p>No students enrolled yet</p></div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Name</th><th>Matric No.</th><th>Status</th><th>Level</th><th>Session</th><th>Semester</th>{isAdmin && <th>Actions</th>}</tr></thead>
                            <tbody>
                                {students.map(e => (
                                    <tr key={e.id}>
                                        <td>
                                            {!isAdmin && user.role === 'STUDENT' ? (
                                                <span style={{ fontWeight: 600 }}>{e.student?.firstName} {e.student?.lastName}</span>
                                            ) : (
                                                <Link to={`/students/${e.student?.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                                    {e.student?.firstName} {e.student?.lastName}
                                                </Link>
                                            )}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{e.student?.matricNumber}</td>
                                        <td>
                                            {e.student?.isInClass ? (
                                                <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} /> In Class
                                                </span>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: '0.8rem' }}>Absent</span>
                                            )}
                                        </td>
                                        <td><span className="badge badge-blue">{e.student?.level}L</span></td>
                                        <td style={{ fontSize: '0.85rem' }}>{e.session}</td>
                                        <td><span className="badge badge-muted">{e.semester}</span></td>
                                        {(isAdmin || isInstructor) && (
                                            <td>
                                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleUnenrollStudent(e.student?.id, `${e.student?.firstName} ${e.student?.lastName}`)} title="Unenroll">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {tab === 'enroll' && (isAdmin || isInstructor) && (
                <div className="card">
                    <div style={{ marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                        <h3 style={{ marginBottom: 8, fontWeight: 700 }}>Quick Auto-Enroll</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
                            Automatically enroll all active students who belong to the departments and levels assigned to this course.
                        </p>
                        <div className="flex items-center gap-12 flex-wrap">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <input value={session} onChange={e => setSession(e.target.value)} placeholder="Session" style={{ width: 140 }} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <select value={semester} onChange={e => setSemester(e.target.value)} style={{ width: 160 }}>
                                    <option value="FIRST">First Semester</option>
                                    <option value="SECOND">Second Semester</option>
                                </select>
                            </div>
                            <button className="btn btn-primary" onClick={handleAutoEnroll} disabled={enrolling}>
                                {enrolling ? 'Processing...' : 'Auto-Enroll by Assignments'}
                            </button>
                        </div>
                    </div>

                    <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Manual Enrollment (Fallback)</h3>
                    <form onSubmit={handleEnroll} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Academic Session</label>
                                <input value={session} onChange={e => setSession(e.target.value)} placeholder="e.g. 2024/2025" />
                            </div>
                            <div className="form-group">
                                <label>Semester</label>
                                <select value={semester} onChange={e => setSemester(e.target.value)}>
                                    <option value="FIRST">First Semester</option>
                                    <option value="SECOND">Second Semester</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Matric Numbers (one per line or comma-separated)</label>
                            <textarea
                                rows={6}
                                placeholder="CSC/2021/001&#10;CSC/2021/002&#10;CSC/2021/003"
                                value={matricList}
                                onChange={e => setMatricList(e.target.value)}
                            />
                        </div>
                        <div>
                            <button type="submit" className="btn btn-primary" disabled={enrolling || !matricList.trim()}>
                                {enrolling ? 'Enrolling…' : 'Enroll Students'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {tab === 'curriculum' && (
                <div className="card">
                    <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontWeight: 700 }}>Course Curriculum</h3>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', gap: 32, flexWrap: 'wrap' }}>
                        {(isAdmin || isInstructor) && (
                            <div style={{ flex: '1 1 300px', minWidth: 280 }}>
                                <h4 style={{ fontWeight: 600, marginBottom: 16 }}>
                                    {editingTopicId ? 'Edit Topic' : 'Add New Topic'}
                                </h4>
                                <form onSubmit={handleSaveTopic} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Title <span style={{ color: 'red' }}>*</span></label>
                                        <input value={topicForm.title} onChange={e => setTopicForm({ ...topicForm, title: e.target.value })} placeholder="e.g. Introduction to React" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Description (Optional)</label>
                                        <textarea value={topicForm.description} onChange={e => setTopicForm({ ...topicForm, description: e.target.value })} placeholder="What will be covered in this topic?" rows={3} />
                                    </div>
                                    <div className="flex gap-12">
                                        <button type="submit" className="btn btn-primary" disabled={savingTopic || !topicForm.title.trim()}>
                                            {savingTopic ? 'Saving...' : editingTopicId ? 'Update Topic' : 'Add Topic'}
                                        </button>
                                        {editingTopicId && (
                                            <button type="button" className="btn btn-secondary" onClick={() => { setEditingTopicId(null); setTopicForm({ title: '', description: '' }); }}>
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>
                        )}

                        <div style={{ flex: '2 1 400px', minWidth: 280 }} className="flex flex-col gap-12">
                            {topics.length === 0 ? (
                                <div className="empty" style={{ padding: 32 }}>
                                    <BookOpen size={48} />
                                    <p>No curriculum topics defined yet</p>
                                </div>
                            ) : (
                                topics.map((topic, index) => (
                                    <div key={topic.id} className="flex gap-16 items-start" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                                        <div style={{ background: 'var(--bg-secondary)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            {index + 1}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div className="flex items-center justify-between">
                                                <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>{topic.title}</h4>
                                                {(isAdmin || isInstructor) && (
                                                    <div className="flex gap-8">
                                                        <button type="button" className="btn-icon" style={{ color: 'var(--accent)' }} onClick={() => { setEditingTopicId(topic.id); setTopicForm({ title: topic.title, description: topic.description || '' }); }}>
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button type="button" className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteTopic(topic.id)}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {topic.description && <p style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{topic.description}</p>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'resources' && (
                <div className="card">
                    <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontWeight: 700 }}>Course Materials</h3>
                        {(isAdmin || isInstructor) && (
                            <button className="btn btn-primary btn-sm" onClick={() => {
                                setResourceForm({ title: '', description: '', type: 'VIDEO', isExternal: false, url: '' });
                                setUploadingFile(null);
                                setResourceModal(true);
                            }}>
                                <Plus size={14} /> Add Resource
                            </button>
                        )}
                    </div>

                    {loadingResources ? <div className="loading-wrap" style={{ minHeight: 100 }}><div className="spinner" /></div> :
                        resources.length === 0 ? (
                            <div className="empty" style={{ padding: '20px 0' }}>
                                <BookOpen size={40} />
                                <p>No materials uploaded for this course yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                {resources.map(res => (
                                    <div key={res.id} className="resource-card" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ padding: 12, flex: 1 }}>
                                            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                                                <span className={`badge ${res.type === 'VIDEO' ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: '0.65rem' }}>{res.type}</span>
                                                {(isAdmin || res.uploadedById === user?.id) && (
                                                    <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteResource(res.id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>{res.title}</h4>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{res.description || 'No description.'}</p>
                                        </div>
                                        <div style={{ padding: 12, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                            {res.isExternal ? (
                                                <button onClick={() => setViewingMaterial(res)} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>View Link</button>
                                            ) : (
                                                <button onClick={() => setViewingMaterial(res)} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>View / Read</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>
            )}

            {tab === 'assignments' && (isAdmin || isInstructor) && (
                <div className="card">
                    <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Course Assignments</h3>
                    <form onSubmit={handleUpdateAssignments} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div className="form-group">
                            <label style={{ marginBottom: 8, display: 'block' }}>Assigned Semesters</label>
                            <div className="flex flex-wrap gap-8">
                                {['FIRST', 'SECOND'].map(sem => {
                                    const selected = editSemesters.includes(sem);
                                    return (
                                        <label key={sem} style={{
                                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                            background: selected ? 'var(--accent-dim)' : 'var(--bg-card)',
                                            color: selected ? 'var(--accent-dark)' : 'var(--text-secondary)',
                                            padding: '8px 16px', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, transition: 'all 0.15s'
                                        }}>
                                            <input type="checkbox" style={{ display: 'none' }} checked={selected}
                                                onChange={(e) => {
                                                    if (e.target.checked) setEditSemesters([...editSemesters, sem]);
                                                    else setEditSemesters(editSemesters.filter(s => s !== sem));
                                                }}
                                            />
                                            {selected && <Check size={16} />}
                                            {sem === 'FIRST' ? 'First Semester' : 'Second Semester'}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ marginBottom: 8, display: 'block' }}>Assigned Levels</label>
                            <div className="flex flex-wrap gap-8">
                                {[100, 200, 300, 400, 500].map(lvl => {
                                    const selected = editLevels.includes(lvl);
                                    return (
                                        <label key={lvl} style={{
                                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                            background: selected ? 'var(--accent-dim)' : 'var(--bg-card)',
                                            color: selected ? 'var(--accent-dark)' : 'var(--text-secondary)',
                                            padding: '8px 16px', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, transition: 'all 0.15s'
                                        }}>
                                            <input type="checkbox" style={{ display: 'none' }} checked={selected}
                                                onChange={(e) => {
                                                    if (e.target.checked) setEditLevels([...editLevels, lvl]);
                                                    else setEditLevels(editLevels.filter(l => l !== lvl));
                                                }}
                                            />
                                            {selected && <Check size={16} />}
                                            {lvl}L
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="form-group">
                            <label style={{ marginBottom: 8, display: 'block' }}>Assigned Departments</label>
                            <div className="flex flex-wrap gap-8">
                                {allDepartments.map(dept => {
                                    const selected = editDepts.includes(dept.id);
                                    return (
                                        <label key={dept.id} style={{
                                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                                            background: selected ? 'var(--accent-dim)' : 'var(--bg-card)',
                                            color: selected ? 'var(--accent-dark)' : 'var(--text-secondary)',
                                            padding: '8px 16px', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, transition: 'all 0.15s'
                                        }}>
                                            <input type="checkbox" style={{ display: 'none' }} checked={selected}
                                                onChange={(e) => {
                                                    if (e.target.checked) setEditDepts([...editDepts, dept.id]);
                                                    else setEditDepts(editDepts.filter(d => d !== dept.id));
                                                }}
                                            />
                                            {selected && <Check size={16} />}
                                            {dept.name}
                                        </label>
                                    );
                                })}
                                {allDepartments.length === 0 && <span className="text-muted">No departments found.</span>}
                            </div>
                        </div>
                        <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <button type="submit" className="btn btn-primary" disabled={savingAssignments}>
                                {savingAssignments ? 'Saving…' : 'Save Assignments'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {resourceModal && (
                <div className="modal-backdrop" onClick={() => setResourceModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Add Course Resource</span>
                            <button className="btn-icon" onClick={() => setResourceModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveResource}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Title *</label>
                                    <input required value={resourceForm.title} onChange={e => setResourceForm({ ...resourceForm, title: e.target.value })} placeholder="e.g. Week 1 Lecture Video" />
                                </div>
                                <div className="form-group">
                                    <label>Description (Optional)</label>
                                    <textarea value={resourceForm.description} onChange={e => setResourceForm({ ...resourceForm, description: e.target.value })} rows={2} />
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Type</label>
                                        <select value={resourceForm.type} onChange={e => setResourceForm({ ...resourceForm, type: e.target.value })}>
                                            <option value="VIDEO">Video Recording</option>
                                            <option value="AUDIO">Audio Recording</option>
                                            <option value="READING">Document / Reading Material</option>
                                            <option value="SLIDE">Slides / Presentation</option>
                                            <option value="SPREADSHEET">Spreadsheet</option>
                                            <option value="OTHER">Other / Archive</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Source</label>
                                        <select value={resourceForm.isExternal} onChange={e => setResourceForm({ ...resourceForm, isExternal: e.target.value === 'true' })}>
                                            <option value="false">Local Upload</option>
                                            <option value="true">External Link</option>
                                        </select>
                                    </div>
                                </div>
                                {resourceForm.isExternal ? (
                                    <div className="form-group">
                                        <label>URL *</label>
                                        <input required type="url" value={resourceForm.url} onChange={e => setResourceForm({ ...resourceForm, url: e.target.value })} placeholder="https://youtube.com/..." />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>File Upload (Max 200MB) *</label>
                                        <input type="file" required={!resourceForm.isExternal} onChange={e => setUploadingFile(e.target.files[0])} />
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Allowed: Video, Audio, PDF, PPT, Word, Excel, Archives</div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setResourceModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={savingResource}>{savingResource ? 'Uploading...' : 'Upload Resource'}</button>
                            </div>
                        </form>
                    </div>
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
                            {(viewingMaterial.type === 'VIDEO' || viewingMaterial.type === 'AUDIO') ? (
                                viewingMaterial.type === 'VIDEO' ? (
                                    <video
                                        src={viewingMaterial.url.startsWith('http') ? viewingMaterial.url : `${SERVER_URL}${viewingMaterial.url}`}
                                        controls
                                        autoPlay
                                        style={{ width: '100%', maxHeight: '80vh' }}
                                    />
                                ) : (
                                    <audio
                                        src={viewingMaterial.url.startsWith('http') ? viewingMaterial.url : `${SERVER_URL}${viewingMaterial.url}`}
                                        controls
                                        autoPlay
                                        style={{ width: '100%', maxWidth: '400px' }}
                                    />
                                )
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

            {assignInstructorModal && (
                <div className="modal-backdrop" onClick={() => setAssignInstructorModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Assign Instructor</span>
                            <button className="btn-icon" onClick={() => setAssignInstructorModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAssignInstructor}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Select Instructor *</label>
                                    <select value={selectedInstructorId} onChange={e => setSelectedInstructorId(e.target.value)} required>
                                        <option value="">-- Choose Instructor --</option>
                                        {availableInstructors.map(inst => (
                                            <option key={inst.id} value={inst.id}>{inst.firstName} {inst.lastName} ({inst.staffId || 'No Staff ID'})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setAssignInstructorModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={assigningInstructor || !selectedInstructorId}>
                                    {assigningInstructor ? 'Assigning...' : 'Assign Instructor'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── MY NOTES (students only) ─────────────────────────────── */}
            {tab === 'notes' && user?.role === 'STUDENT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* ── Note editor card ── */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-16">
                            <h3 style={{ fontWeight: 700, margin: 0 }}>
                                {editingNoteId ? '✏️ Edit Note' : '+ New Note'}
                            </h3>
                            <div className="flex gap-8">
                                <button
                                    type="button"
                                    className={`btn btn-sm ${notePreview ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setNotePreview(v => !v)}
                                    title={notePreview ? 'Back to editor' : 'Preview markdown'}
                                >
                                    {notePreview ? <PenLine size={14} /> : <Eye size={14} />}
                                    {notePreview ? 'Edit' : 'Preview'}
                                </button>
                                {editingNoteId && (
                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => {
                                        setEditingNoteId(null);
                                        setNoteForm({ title: '', content: '', color: '#ffffff', topicId: '' });
                                        setNotePreview(false);
                                    }}>Cancel</button>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Title + color row */}
                            <div className="flex gap-12" style={{ alignItems: 'center' }}>
                                <div className="form-group" style={{ flex: 1, minWidth: '60%', marginBottom: 0 }}>
                                    <label>Title *</label>
                                    <input
                                        required
                                        value={noteForm.title}
                                        onChange={e => setNoteForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="e.g. Lecture 3 Summary"
                                        style={{ width: '100%', fontSize: '1.1rem', padding: '10px 14px', fontWeight: 500, display: 'block' }}
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
                                                onClick={() => setNoteForm(f => ({ ...f, color: c.value }))}
                                                style={{
                                                    width: 22, height: 22, borderRadius: '50%',
                                                    background: c.value,
                                                    border: noteForm.color === c.value
                                                        ? '2.5px solid var(--accent)'
                                                        : '2px solid var(--border)',
                                                    cursor: 'pointer', transition: 'transform 0.15s',
                                                    transform: noteForm.color === c.value ? 'scale(1.25)' : 'scale(1)',
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Topic filter */}
                            {topics.length > 0 && (
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label>Linked Topic (optional)</label>
                                    <select value={noteForm.topicId} onChange={e => setNoteForm(f => ({ ...f, topicId: e.target.value }))}>
                                        <option value="">— No specific topic —</option>
                                        {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Editor / Preview toggle */}
                            {notePreview ? (
                                <div
                                    style={{
                                        minHeight: 200, padding: 16,
                                        background: noteForm.color || '#ffffff',
                                        border: '1px solid var(--border)', borderRadius: 8,
                                        lineHeight: 1.7, fontSize: '0.9rem',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: noteForm.content }}
                                />
                            ) : (
                                <div className="form-group quill-container" style={{ marginBottom: 0 }}>
                                    <label>Content *</label>
                                    <ReactQuill
                                        theme="snow"
                                        value={noteForm.content}
                                        onChange={(val) => setNoteForm(f => ({ ...f, content: val }))}
                                        placeholder="Write your class summary here..."
                                        style={{ background: '#fff' }}
                                    />
                                </div>
                            )}

                            <div>
                                <button type="submit" className="btn btn-primary" disabled={savingNote || !noteForm.title.trim() || !noteForm.content.trim() || noteForm.content === '<p><br></p>'}>
                                    <StickyNote size={15} />
                                    {savingNote ? 'Saving…' : editingNoteId ? 'Update Note' : 'Save Note'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* ── Saved notes list ── */}
                    {loadingNotes ? (
                        <div className="loading-wrap"><div className="spinner" /></div>
                    ) : notes.length === 0 ? (
                        <div className="empty">
                            <StickyNote size={48} />
                            <p>No notes yet — write your first class summary above!</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                            {notes.map(note => (
                                <div
                                    key={note.id}
                                    style={{
                                        background: note.color || '#ffffff',
                                        border: '1px solid var(--border)',
                                        borderRadius: 12,
                                        padding: 18,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        transition: 'transform 0.15s',
                                        cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
                                    onClick={() => setViewNote(note)}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between" style={{ gap: 8 }}>
                                        <h4 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, flex: 1 }}>{note.title}</h4>
                                        <div className="flex gap-4" onClick={e => e.stopPropagation()}>
                                            <button
                                                className="btn-icon" title="Edit"
                                                style={{ color: 'var(--accent)' }}
                                                onClick={() => startEditNote(note)}
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                className="btn-icon" title="Delete"
                                                style={{ color: 'var(--danger)' }}
                                                onClick={() => handleDeleteNote(note.id)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Topic badge */}
                                    {note.topic && (
                                        <span className="badge badge-blue" style={{ fontSize: '0.7rem', width: 'fit-content' }}>{note.topic.title}</span>
                                    )}

                                    {/* Content preview */}
                                    <p style={{
                                        fontSize: '0.82rem',
                                        color: 'var(--text-secondary)',
                                        margin: 0,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        lineHeight: 1.55,
                                    }}>
                                        {/* Strip HTML tags and entities for preview */}
                                        {note.content.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').substring(0, 200)}
                                    </p>

                                    {/* Footer */}
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: 4 }}>
                                        {new Date(note.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Full note viewer modal ── */}
                    {viewNote && (
                        <div
                            className="modal-backdrop"
                            onClick={() => setViewNote(null)}
                            style={{ zIndex: 9999 }}
                        >
                            <div
                                className="modal"
                                style={{ maxWidth: 720, width: '95%', background: viewNote.color || '#fff' }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="modal-header" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                                    <div>
                                        <span className="modal-title">{viewNote.title}</span>
                                        {viewNote.topic && (
                                            <span className="badge badge-blue" style={{ marginLeft: 10, fontSize: '0.7rem' }}>{viewNote.topic.title}</span>
                                        )}
                                    </div>
                                    <div className="flex gap-8">
                                        <button className="btn btn-sm btn-secondary" onClick={() => { startEditNote(viewNote); setViewNote(null); }}>
                                            <Edit2 size={13} /> Edit
                                        </button>
                                        <button className="btn-icon" onClick={() => setViewNote(null)}><X size={20} /></button>
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
            )}
        </div>
    );
}
