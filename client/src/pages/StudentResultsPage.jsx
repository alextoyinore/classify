import { useEffect, useState, useCallback } from 'react';
import { Search, FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const PAGE_SIZE = 20;

export default function StudentResultsPage() {
    const toast = useToast();
    const [results, setResults]   = useState([]);
    const [total, setTotal]       = useState(0);
    const [pages, setPages]       = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading]   = useState(false);
    const [depts, setDepts]       = useState([]);
    const [courses, setCourses]   = useState([]);

    // Filters (server-side)
    const [dept, setDept]     = useState('');
    const [course, setCourse] = useState('');
    const [level, setLevel]   = useState('');

    // Client-side quick search (name / matric)
    const [search, setSearch] = useState('');

    const loadData = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const { data } = await api.get('/students/results/aggregate', {
                params: {
                    departmentId: dept   || undefined,
                    courseId:     course || undefined,
                    level:        level  || undefined,
                    page:  pg,
                    limit: PAGE_SIZE,
                }
            });
            setResults(data.data ?? []);
            setTotal(data.total ?? 0);
            setPages(data.pages ?? 1);
            setCurrentPage(data.page ?? 1);
        } catch {
            toast('Failed to load results', 'error');
        }
        setLoading(false);
    }, [dept, course, level]);

    // Load lookup lists once
    useEffect(() => {
        (async () => {
            try {
                const [dRes, cRes] = await Promise.all([
                    api.get('/departments'),
                    api.get('/courses'),
                ]);
                setDepts(dRes.data || []);
                setCourses(cRes.data.data || []);
            } catch {}
        })();
    }, []);

    // Reload when filters change (reset to page 1)
    useEffect(() => {
        setCurrentPage(1);
        loadData(1);
    }, [dept, course, level]);

    const goToPage = (pg) => {
        if (pg < 1 || pg > pages) return;
        loadData(pg);
    };

    // Local filter on already-fetched page
    const filteredResults = results.filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
            r.matricNumber.toLowerCase().includes(q)
        );
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
        const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `results_aggregate_${new Date().toISOString().split('T')[0]}.csv`;
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

            {/* Filter / Search Bar */}
            <div className="search-bar flex-nowrap" style={{ gap: 8 }}>
                <div className="search-input-wrap flex-1" style={{ minWidth: 200 }}>
                    <Search className="search-icon" size={16} />
                    <input
                        placeholder="Search by name or matric no…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="divider-v" />

                <select value={dept} onChange={e => { setDept(e.target.value); }} className="w-180" style={{ flexShrink: 0 }}>
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
                <>
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
                                {filteredResults.map(r =>
                                    r.courses.map((c, idx) => (
                                        <tr key={`${r.id}-${c.courseCode}`}>
                                            {idx === 0 && (
                                                <td rowSpan={r.courses.length} style={{ verticalAlign: 'top', paddingTop: 12 }}>
                                                    <div style={{ fontWeight: 600 }}>{r.firstName} {r.lastName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.department} • {r.level}L</div>
                                                </td>
                                            )}
                                            {idx === 0 && (
                                                <td rowSpan={r.courses.length} style={{ verticalAlign: 'top', paddingTop: 12, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                                                    {r.matricNumber}
                                                </td>
                                            )}
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
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-16" style={{ flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Showing page <strong>{currentPage}</strong> of <strong>{pages}</strong> &nbsp;·&nbsp; {total} students total
                        </span>
                        <div className="flex gap-8">
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage <= 1 || loading}
                            >
                                <ChevronLeft size={14} /> Previous
                            </button>

                            {/* Page number pills */}
                            <div className="flex gap-4">
                                {Array.from({ length: pages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === pages || Math.abs(p - currentPage) <= 2)
                                    .reduce((acc, p, i, arr) => {
                                        if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, i) =>
                                        p === '…' ? (
                                            <span key={`ellipsis-${i}`} style={{ padding: '4px 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>…</span>
                                        ) : (
                                            <button
                                                key={p}
                                                className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => goToPage(p)}
                                                disabled={loading}
                                                style={{ minWidth: 36 }}
                                            >
                                                {p}
                                            </button>
                                        )
                                    )
                                }
                            </div>

                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage >= pages || loading}
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
