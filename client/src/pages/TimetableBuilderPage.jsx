import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Calendar, Clock, MapPin, User, BookOpen, AlertCircle } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const LEVELS = [100, 200, 300, 400, 500];

export default function TimetableBuilderPage() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [timetable, setTimetable] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [semesters, setSemesters] = useState([]);
    const [courses, setCourses] = useState([]);
    const [instructors, setInstructors] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        departmentId: '',
        semesterId: '',
        level: 100
    });

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [form, setForm] = useState({
        courseId: '',
        instructorId: '',
        semesterId: '',
        departmentId: '',
        dayOfWeek: 'MONDAY',
        startTime: '08:00',
        endTime: '10:00',
        location: '',
        level: 100
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [deptsRes, semRes, coursesRes, instRes] = await Promise.all([
                    api.get('/departments'),
                    api.get('/sessions'),
                    api.get('/courses'),
                    api.get('/instructors')
                ]);

                const deptsData = deptsRes.data?.data || deptsRes.data || [];
                setDepartments(deptsData);

                const semestersData = semRes.data || [];
                setSemesters(semestersData);

                const current = semestersData.find(s => s.isCurrent);
                if (current) {
                    setFilters(prev => ({ ...prev, semesterId: current.id }));
                } else if (semestersData.length > 0) {
                    setFilters(prev => ({ ...prev, semesterId: semestersData[0].id }));
                }

                setCourses(coursesRes.data?.data || coursesRes.data || []);
                setInstructors(instRes.data?.data || instRes.data || []);
            } catch (err) {
                toast('Failed to load initial data', 'error');
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    const fetchTimetable = async () => {
        if (!filters.semesterId) return;
        try {
            const { data } = await api.get('/timetable', { params: filters });
            setTimetable(data.data || []);
        } catch (err) {
            toast('Failed to load timetable', 'error');
        }
    };

    useEffect(() => {
        fetchTimetable();
    }, [filters]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                departmentId: filters.departmentId || null,
                semesterId: filters.semesterId,
                level: Number(filters.level)
            };

            if (editingEntry) {
                await api.patch(`/timetable/${editingEntry.id}`, payload);
                toast('Timetable entry updated');
            } else {
                await api.post('/timetable', payload);
                toast('Timetable entry added');
            }
            setShowModal(false);
            fetchTimetable();
        } catch (err) {
            toast(err.response?.data?.error || 'Save failed', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this entry?')) return;
        try {
            await api.delete(`/timetable/${id}`);
            toast('Entry deleted');
            fetchTimetable();
        } catch (err) {
            toast('Delete failed', 'error');
        }
    };

    const openAddModal = (day = 'MONDAY', time = '08:00') => {
        setEditingEntry(null);
        setForm({
            courseId: '',
            instructorId: '',
            semesterId: filters.semesterId,
            departmentId: filters.departmentId || '',
            dayOfWeek: day,
            startTime: time,
            endTime: '10:00',
            location: '',
            level: filters.level
        });
        setShowModal(true);
    };

    const openEditModal = (entry) => {
        setEditingEntry(entry);
        setForm({
            courseId: entry.courseId,
            instructorId: entry.instructorId || '',
            semesterId: entry.semesterId,
            departmentId: entry.departmentId || '',
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            location: entry.location || '',
            level: entry.level
        });
        setShowModal(true);
    };

    if (loading) return <div className="loading-wrap"><div className="spinner"></div></div>;

    return (
        <div className="timetable-builder">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Timetable Builder</h1>
                    <p className="page-subtitle">Design and manage lecture schedules for departments and levels.</p>
                </div>
                <button className="btn btn-primary" onClick={() => openAddModal()}>
                    <Plus size={16} /> Add Entry
                </button>
            </div>

            <div className="filters-card card mb-24">
                <div className="grid grid-3 gap-16">
                    <div className="form-group">
                        <label>Department</label>
                        <select
                            value={filters.departmentId}
                            onChange={e => setFilters({ ...filters, departmentId: e.target.value })}
                        >
                            <option value="">All Departments</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Level</label>
                        <select
                            value={filters.level}
                            onChange={e => setFilters({ ...filters, level: Number(e.target.value) })}
                        >
                            {LEVELS.map(l => <option key={l} value={l}>{l} Level</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Semester</label>
                        <select
                            value={filters.semesterId}
                            onChange={e => setFilters({ ...filters, semesterId: e.target.value })}
                        >
                            <option value="">Select Semester</option>
                            {semesters.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.session?.title || 'Unknown Session'} - {s.name === 'FIRST' ? '1st' : '2nd'} Semester
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="timetable-container card p-0">
                <div className="timetable-grid">
                    <div className="timetable-header-row">
                        {DAYS.map(day => (
                            <div key={day} className="day-header">{day.charAt(0) + day.slice(1).toLowerCase()}</div>
                        ))}
                    </div>

                    <div className="timetable-body">
                        {/* We'll use a swimlane approach for easier rendering */}
                        {DAYS.map(day => (
                            <div key={day} className="day-column">
                                <div className="day-label-mobile">{day}</div>
                                <div className="entries-list">
                                    {timetable.filter(e => e.dayOfWeek === day).length === 0 ? (
                                        <div className="empty-slot-msg">No lectures</div>
                                    ) : (
                                        timetable
                                            .filter(e => e.dayOfWeek === day)
                                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                            .map(entry => (
                                                <div key={entry.id} className="entry-card" onClick={() => openEditModal(entry)}>
                                                    <div className="entry-time">
                                                        <Clock size={12} /> {entry.startTime} - {entry.endTime}
                                                    </div>
                                                    <div className="entry-title">{entry.course?.code}: {entry.course?.title}</div>
                                                    <div className="entry-footer">
                                                        <span><User size={12} /> {entry.instructor ? `${entry.instructor.firstName} ${entry.instructor.lastName}` : 'TBA'}</span>
                                                        <span><MapPin size={12} /> {entry.location || 'TBA'}</span>
                                                    </div>
                                                    <button className="entry-delete" onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingEntry ? 'Edit' : 'Add'} Timetable Entry</h2>
                            <button className="btn-close" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="grid grid-2 gap-16 mb-16">
                                <div className="form-group">
                                    <label>Course *</label>
                                    <select required value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })}>
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.code} {c.title}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Instructor</label>
                                    <select value={form.instructorId} onChange={e => setForm({ ...form, instructorId: e.target.value })}>
                                        <option value="">Select Instructor</option>
                                        {instructors.map(i => <option key={i.id} value={i.id}>{i.firstName} {i.lastName}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-3 gap-16 mb-20">
                                <div className="form-group">
                                    <label>Day *</label>
                                    <select value={form.dayOfWeek} onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}>
                                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Start Time *</label>
                                    <input type="time" required value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>End Time *</label>
                                    <input type="time" required value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                                </div>
                            </div>

                            <div className="form-group mb-24">
                                <label>Location</label>
                                <div className="input-with-icon">
                                    <MapPin size={16} />
                                    <input placeholder="e.g. Hall A, Science Block" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Entry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .timetable-container {
                    overflow-x: auto;
                    background: #fff;
                }
                .timetable-grid {
                    min-width: 900px;
                }
                .timetable-header-row {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border);
                }
                .day-header {
                    padding: 12px;
                    text-align: center;
                    font-weight: 700;
                    color: var(--text-primary);
                    border-right: 1px solid var(--border);
                }
                .day-header:last-child { border-right: none; }
                
                .timetable-body {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    min-height: 400px;
                }
                .day-column {
                    border-right: 1px solid var(--border);
                    background: #fff;
                }
                .day-column:last-child { border-right: none; }
                
                .day-label-mobile { display: none; }
                
                .entries-list {
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .empty-slot-msg {
                    text-align: center;
                    color: var(--text-muted);
                    font-size: 0.8rem;
                    padding: 20px 0;
                    font-style: italic;
                }
                
                .entry-card {
                    background: var(--accent-dim);
                    border-left: 4px solid var(--accent);
                    padding: 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    position: relative;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .entry-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .entry-time {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--accent);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    margin-bottom: 6px;
                }
                .entry-title {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 8px;
                    line-height: 1.3;
                }
                .entry-footer {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                }
                .entry-footer span {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .entry-delete {
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    background: rgba(220, 38, 38, 0.1);
                    color: var(--danger);
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .entry-card:hover .entry-delete { opacity: 1; }
                
                .input-with-icon {
                    position: relative;
                }
                .input-with-icon svg {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }
                .input-with-icon input {
                    padding-left: 36px !important;
                }

                /* Modal Styles */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9000;
                    padding: 20px;
                    animation: fadeIn 0.2s ease-out;
                }
                .modal-content {
                    background: #fff;
                    border-radius: 16px;
                    width: 100%;
                    max-width: 600px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.15);
                    padding: 32px;
                    position: relative;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .modal-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 800;
                }
                .btn-close {
                    background: var(--bg-secondary);
                    border: none;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    font-size: 20px;
                    color: var(--text-secondary);
                    transition: all 0.2s;
                }
                .btn-close:hover {
                    background: var(--border);
                    color: var(--text-primary);
                }
                .modal-footer {
                    margin-top: 32px;
                    display: flex;
                    justify-content: end;
                    gap: 12px;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                @media (max-width: 900px) {
                    .timetable-grid { min-width: 100%; }
                    .timetable-header-row { display: none; }
                    .timetable-body { grid-template-columns: 1fr; }
                    .day-column { border-right: none; border-bottom: 12px solid var(--bg-secondary); }
                    .day-label-mobile {
                        display: block;
                        background: var(--bg-secondary);
                        padding: 10px 16px;
                        font-weight: 800;
                        text-transform: uppercase;
                        font-size: 0.8rem;
                        letter-spacing: 0.05em;
                        color: var(--text-secondary);
                    }
                }
            `}</style>
        </div>
    );
}
