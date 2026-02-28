import { useEffect, useState } from 'react';
import { Search, FileText, Download, Filter } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

export default function StudentResultsPage() {
    const toast = useToast();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [depts, setDepts] = useState([]);
    const [courses, setCourses] = useState([]);

    // Filters
    const [dept, setDept] = useState('');
    const [course, setCourse] = useState('');
    const [level, setLevel] = useState('');
    const [search, setSearch] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [rRes, dRes, cRes] = await Promise.all([
                api.get('/students/results/aggregate', { params: { departmentId: dept || undefined, courseId: course || undefined, level: level || undefined } }),
                api.get('/departments'),
                api.get('/courses')
            ]);
            setResults(rRes.data);
            setDepts(dRes.data || []);
            setCourses(cRes.data.data || []);
        } catch (err) {
            toast('Failed to load results', 'error');
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [dept, course, level]);

    const filteredResults = results.filter(r => {
        const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
        const matric = r.matricNumber.toLowerCase();
        const query = search.toLowerCase();
        return fullName.includes(query) || matric.includes(query);
    });

    const handleExport = () => {
        if (!results.length) return;
        const headers = ['Matric No', 'Name', 'Dept', 'Level', 'Course', 'Attendance', 'Test', 'Exam', 'Total'];
        const rows = results.flatMap(r => r.courses.map(c => [
            r.matricNumber,
            `${r.firstName} ${r.lastName}`,
            r.department,
            r.level,
            c.courseCode,
            c.attendance.score,
            c.test.score,
            c.exam.score,
            c.total
        ]));

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `results_aggregate_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="animate-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Aggregate Results</h1>
                    <p className="page-subtitle">Consolidated scores including Attendance, Tests, and Examinations</p>
                </div>
                <button className="btn btn-secondary" onClick={handleExport} disabled={!results.length}>
                    <Download size={16} /> Export CSV
                </button>
            </div>

            <div className="search-bar flex-nowrap" style={{ gap: 8 }}>
                <div className="search-input-wrap flex-1" style={{ minWidth: 200 }}>
                    <Search className="search-icon" size={16} />
                    <input
                        placeholder="Search student by name or matric number..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="divider-v" />

                <select value={dept} onChange={e => setDept(e.target.value)} className="w-180" style={{ flexShrink: 0 }}>
                    <option value="">All Departments</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>

                <select value={level} onChange={e => setLevel(e.target.value)} className="w-100" style={{ flexShrink: 0 }}>
                    <option value="">Levels</option>
                    {[100, 200, 300, 400, 500].map(l => <option key={l} value={l}>{l}L</option>)}
                </select>

                <select value={course} onChange={e => setCourse(e.target.value)} className="w-180" style={{ flexShrink: 0 }}>
                    <option value="">All Courses</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.title}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="loading-wrap"><div className="spinner" /></div>
            ) : filteredResults.length === 0 ? (
                <div className="empty">
                    <FileText size={48} />
                    <p>{search ? `No results match "${search}"` : 'No results found for the selected criteria'}</p>
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Matric No.</th>
                                <th>Course</th>
                                <th className="text-center">Attendance</th>
                                <th className="text-center">Tests</th>
                                <th className="text-center">Exams</th>
                                <th className="text-center">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredResults.map((r) => (
                                r.courses.map((c, idx) => (
                                    <tr key={`${r.id}-${c.courseCode}`}>
                                        {idx === 0 ? (
                                            <td rowSpan={r.courses.length} style={{ verticalAlign: 'top', paddingTop: 12 }}>
                                                <div style={{ fontWeight: 600 }}>{r.firstName} {r.lastName}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.department} • {r.level}L</div>
                                            </td>
                                        ) : null}
                                        {idx === 0 ? (
                                            <td rowSpan={r.courses.length} style={{ verticalAlign: 'top', paddingTop: 12, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                                                {r.matricNumber}
                                            </td>
                                        ) : null}
                                        <td>
                                            <div style={{ fontWeight: 500 }}>{c.courseCode}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.courseTitle}</div>
                                        </td>
                                        <td className="text-center">
                                            <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.attendance.score}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>({c.attendance.present}/{c.attendance.total})</div>
                                        </td>
                                        <td className="text-center">
                                            <div style={{ fontWeight: 600 }}>{c.test.score}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Max: {c.test.max}</div>
                                        </td>
                                        <td className="text-center">
                                            <div style={{ fontWeight: 600 }}>{c.exam.score}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Max: {c.exam.max}</div>
                                        </td>
                                        <td className="text-center">
                                            <div className="badge badge-blue" style={{ fontSize: '0.9rem', padding: '4px 10px' }}>{c.total}</div>
                                        </td>
                                    </tr>
                                ))
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
