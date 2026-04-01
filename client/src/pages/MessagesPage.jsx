import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User as UserIcon, AlertCircle, Search, ArrowLeft, Reply, X, Megaphone, Users, Book } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MessagesPinLock from '../components/MessagesPinLock';
import { getStoredPin, verifyPin, markUnlocked, clearUnlocked, isUnlocked, refreshUnlock, LOCK_TIMEOUT } from '../utils/messagesPin';
import './MessagesPage.css';

export default function MessagesPage() {
    const { user } = useAuth();
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [levelFilter, setLevelFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null);
    
    // Broadcast states
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastTarget, setBroadcastTarget] = useState(user?.role === 'ADMIN' ? 'ALL_STUDENTS' : 'COURSE_STUDENTS');
    const [broadcastCourseId, setBroadcastCourseId] = useState('');
    const [broadcastContent, setBroadcastContent] = useState('');
    const [myCourses, setMyCourses] = useState([]);
    const [broadcasting, setBroadcasting] = useState(false);
    
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const pollInterval = useRef(null);
    const inactivityTimer = useRef(null);

    // PIN lock state
    const storedPin = user ? getStoredPin(user.id) : null;
    const [locked, setLocked] = useState(() => {
        if (!user || !getStoredPin(user.id)) return false;
        return !isUnlocked(user.id);
    });

    const resetInactivityTimer = useCallback(() => {
        if (!user || !getStoredPin(user.id)) return;
        clearTimeout(inactivityTimer.current);
        refreshUnlock(user.id);
        inactivityTimer.current = setTimeout(() => {
            clearUnlocked(user.id);
            setLocked(true);
        }, LOCK_TIMEOUT);
    }, [user]);

    // Start inactivity timer when unlocked, and lock on navigation away
    useEffect(() => {
        if (!storedPin) return;
        if (locked) return;
        resetInactivityTimer();
        const events = ['mousemove', 'keydown', 'click', 'touchstart'];
        events.forEach(e => window.addEventListener(e, resetInactivityTimer));
        return () => {
            clearTimeout(inactivityTimer.current);
            events.forEach(e => window.removeEventListener(e, resetInactivityTimer));
            // Lock when navigating away
            if (user && getStoredPin(user.id)) {
                clearUnlocked(user.id);
                setLocked(true);
            }
        };
    }, [locked, storedPin, resetInactivityTimer, user]);

    const handlePinUnlock = (attempt) => {
        if (verifyPin(user.id, attempt)) {
            markUnlocked(user.id);
            setLocked(false);
            return true;
        }
        return false;
    };

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/messages/users');
            setUsers(data?.data || []);
            setLoadingUsers(false);
        } catch (err) {
            console.error('Failed to fetch chat users', err);
            setLoadingUsers(false);
        }
    };

    const fetchMessages = async (userId, background = false) => {
        if (!background) setLoadingMessages(true);
        try {
            const { data } = await api.get(`/messages/${userId}`);
            setMessages(data?.data || []);
            // Update unread count for this user in the users list
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, unreadCount: 0 } : u));
        } catch (err) {
            if (!background) toast('Failed to load messages', 'error');
        }
        if (!background) setLoadingMessages(false);
    };

    useEffect(() => {
        const loadDeps = async () => {
            try {
                const res = await api.get('/departments');
                setDepartments(res.data || []);
            } catch {}
        };
        loadDeps();
        fetchUsers();
        // Poll for new users/unread counts every 15s
        const userPoll = setInterval(fetchUsers, 15000);
        return () => clearInterval(userPoll);
    }, []);

    useEffect(() => {
        if (selectedUser) {
            fetchMessages(selectedUser.id);
            // Poll active conversation every 3s
            pollInterval.current = setInterval(() => {
                fetchMessages(selectedUser.id, true);
            }, 3000);
        } else {
            setMessages([]);
        }

        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [selectedUser]);

    useEffect(() => {
        // Scroll to bottom when messages change or user is switched
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
    }, [messages, selectedUser]);

    useEffect(() => {
        if (showBroadcastModal) {
            const fetchCourses = async () => {
                try {
                    const { data } = await api.get('/courses', { params: { limit: 100 } });
                    // If instructor, only show courses where they are assigned
                    const filtered = user.role === 'ADMIN' ? data.data : data.data.filter(c => 
                        c.instructors.some(i => i.instructor.id === user.instructor?.id)
                    );
                    setMyCourses(filtered);
                    if (filtered.length > 0 && !broadcastCourseId) {
                        setBroadcastCourseId(filtered[0].id);
                    }
                } catch (err) {
                    console.error('Failed to fetch courses for broadcast', err);
                }
            };
            fetchCourses();
        }
    }, [showBroadcastModal, user, broadcastCourseId]);

    const handleBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastContent.trim()) return;
        if (broadcastTarget === 'COURSE_STUDENTS' && !broadcastCourseId) return;

        setBroadcasting(true);
        try {
            await api.post('/messages/broadcast', {
                target: broadcastTarget,
                courseId: broadcastCourseId,
                content: broadcastContent.trim()
            });
            toast('Broadcast sent successfully');
            setShowBroadcastModal(false);
            setBroadcastContent('');
            fetchUsers(); // Update sidebar with latest messages
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to send broadcast', 'error');
        }
        setBroadcasting(false);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedUser) return;

        const tempId = Date.now().toString();
        const newMsg = {
            id: tempId,
            senderId: user.id,
            receiverId: selectedUser.id,
            content: inputText.trim(),
            createdAt: new Date().toISOString(),
            isRead: false,
            replyTo: replyingTo ? { content: replyingTo.content, senderId: replyingTo.senderId } : null
        };

        // Optimistic update
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        const replyId = replyingTo?.id;
        setReplyingTo(null);
        setSending(true);

        try {
            await api.post('/messages', {
                receiverId: selectedUser.id,
                content: newMsg.content,
                replyToId: replyId
            });
            // Refetch to get actual DB record and handle state
            fetchMessages(selectedUser.id, true);
            fetchUsers(); // Update latest message in sidebar
        } catch (err) {
            toast(err.response?.data?.error || 'Failed to send message', 'error');
            // Remove optimistic message
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
        setSending(false);
    };

    const formatTime = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getDisplayName = (u) => {
        if (!u) return 'Unknown User';
        if (u.role === 'ADMIN') return u.admin?.fullName || 'Admin';
        if (u.role === 'INSTRUCTOR') return `${u.instructor?.firstName || ''} ${u.instructor?.lastName || ''} (Instructor)`.trim();
        if (u.role === 'STUDENT') return `${u.student?.firstName || ''} ${u.student?.lastName || ''} (${u.student?.matricNumber || 'Unknown'})`.trim();
        return 'Unknown User';
    };

    const filteredUsers = users.filter(u => {
        // Only apply department/level constraints to other students
        if (u.role === 'STUDENT') {
            if (departmentFilter) {
                const uDeptId = u.student?.departmentId;
                if (uDeptId !== departmentFilter) return false;
            }
            if (levelFilter) {
                if (String(u.student?.level) !== levelFilter) return false;
            }
        }

        if (!userSearch) return true;
        const searchLower = userSearch.toLowerCase();
        const name = String(getDisplayName(u)).toLowerCase();
        const matchRole = u.role ? String(u.role).toLowerCase() : '';
        return name.includes(searchLower) || matchRole.includes(searchLower);
    });

    return (
        <div className={`messages-container ${selectedUser ? 'mobile-selected' : ''}`}>
            {/* PIN lock overlay */}
            {locked && storedPin && (
                <MessagesPinLock
                    hasPin={true}
                    onUnlock={handlePinUnlock}
                />
            )}
            <div className="messages-sidebar">
                <div className="sidebar-header">
                    <h2>Messages</h2>
                    {(user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR') && (
                        <div className="broadcast-btn-container">
                            <button className="btn-broadcast" onClick={() => setShowBroadcastModal(true)}>
                                <Megaphone size={16} /> Broadcast Message
                            </button>
                        </div>
                    )}
                    <div className="user-search-wrap">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                        />
                    </div>
                    {user?.role === 'STUDENT' && (
                        <div className="flex gap-8" style={{ marginTop: 12, padding: '0 16px', boxSizing: 'border-box' }}>
                            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} style={{ flex: 1, padding: '6px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <option value="">All Depts</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} style={{ width: 80, padding: '6px 8px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)' }}>
                                <option value="">All Lvl</option>
                                {[100, 200, 300, 400, 500, 600].map(l => <option key={l} value={l}>{l}L</option>)}
                            </select>
                        </div>
                    )}
                </div>
                <div className="user-list">
                    {loadingUsers ? (
                        <div className="loading-wrap"><div className="spinner"></div></div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="empty-state">No users found.</div>
                    ) : (
                        filteredUsers.map(u => (
                            <div
                                key={u.id}
                                className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                                onClick={() => setSelectedUser(u)}
                            >
                                <div className="user-avatar">
                                    <UserIcon size={20} />
                                    {u.unreadCount > 0 && <span className="unread-badge">{u.unreadCount}</span>}
                                </div>
                                <div className="user-info">
                                    <div className="user-name-row">
                                        <span className="user-name">{getDisplayName(u)}</span>
                                        {u.lastMessage && (
                                            <span className="last-time">{formatTime(u.lastMessage.createdAt)}</span>
                                        )}
                                    </div>
                                    <div className="user-last-msg">
                                        {u.lastMessage ? u.lastMessage.content : <span style={{ opacity: 0.5 }}>No messages yet</span>}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="messages-main">
                {selectedUser ? (
                    <>
                        <div className="chat-header">
                            <button className="btn-back-mobile" onClick={() => setSelectedUser(null)}>
                                <ArrowLeft size={20} />
                            </button>
                            <div className="chat-header-info">
                                <h3>{getDisplayName(selectedUser)}</h3>
                                {selectedUser.role === 'STUDENT' && <span className="badge badge-secondary" style={{ marginLeft: '12px' }}>Student</span>}
                                {selectedUser.role === 'ADMIN' && <span className="badge badge-primary" style={{ marginLeft: '12px' }}>Admin</span>}
                                {selectedUser.role === 'INSTRUCTOR' && <span className="badge badge-amber" style={{ marginLeft: '12px' }}>Instructor</span>}
                            </div>
                        </div>

                        <div className="chat-messages">
                            {/* Spacer to push content to the bottom when messages are few */}
                            {messages.length > 0 && <div style={{ flex: '1 1 auto' }} />}
                            
                            {loadingMessages ? (
                                <div className="loading-wrap"><div className="spinner"></div></div>
                            ) : messages.length === 0 ? (
                                <div className="chat-empty">
                                    <AlertCircle size={48} color="var(--text-muted)" />
                                    <p>Start the conversation with {getDisplayName(selectedUser)}</p>
                                </div>
                            ) : (
                                messages.map((msg, i) => {
                                    const isMe = msg.senderId === user.id;
                                    const showDate = i === 0 || new Date(msg.createdAt).toDateString() !== new Date(messages[i - 1].createdAt).toDateString();

                                    return (
                                        <div key={msg.id} id={`msg-${msg.id}`} style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                            {showDate && (
                                                <div className="chat-date-divider" style={{ alignSelf: 'center' }}>
                                                    <span>{new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                                <div className={`message-bubble ${isMe ? 'sent' : 'received'}`}>
                                                    {msg.replyTo && (
                                                        <div className="message-reply-ref" onClick={() => {
                                                            const el = document.getElementById(`msg-${msg.replyToId}`);
                                                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                            el?.classList.add('highlight-flash');
                                                            setTimeout(() => el?.classList.remove('highlight-flash'), 2000);
                                                        }}>
                                                            <div className="reply-ref-name">{msg.replyTo.senderId === user.id ? 'You' : 'Them'}</div>
                                                            <div className="reply-ref-content">{msg.replyTo.content}</div>
                                                        </div>
                                                    )}
                                                    <div className="message-content">{msg.content}</div>
                                                    <button className="message-reply-btn" onClick={() => setReplyingTo(msg)} title="Reply">
                                                        <Reply size={14} />
                                                    </button>
                                                </div>
                                                <div className="message-meta">
                                                    {formatTime(msg.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} style={{ height: '1px' }} />
                        </div>

                        <form className="chat-input-area" onSubmit={handleSend}>
                            {replyingTo && (
                                <div className="reply-composer-bar">
                                    <Reply size={14} className="text-muted" />
                                    <div className="reply-composer-content">
                                        <div className="reply-composer-name">Replying to {replyingTo.senderId === user.id ? 'yourself' : 'them'}</div>
                                        <div className="reply-composer-text">{replyingTo.content}</div>
                                    </div>
                                    <button type="button" onClick={() => setReplyingTo(null)} className="reply-composer-close">
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            <div className="input-row">
                                <input
                                    type="text"
                                    placeholder={`Message ${getDisplayName(selectedUser)}...`}
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    disabled={sending}
                                />
                                <button type="submit" disabled={!inputText.trim() || sending} className="btn-send">
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="chat-placeholder">
                        <MessageIcon size={64} style={{ opacity: 0.2, marginBottom: '24px' }} />
                        <h2>Your Messages</h2>
                        <p>Select a conversation from the sidebar to start messaging.</p>
                    </div>
                )}
            </div>

            {/* Broadcast Modal */}
            {showBroadcastModal && (
                <div className="modal-backdrop" onClick={() => !broadcasting && setShowBroadcastModal(false)}>
                    <div className="modal broadcast-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-title">Broadcast Message</span>
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowBroadcastModal(false)} disabled={broadcasting}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleBroadcast}>
                            <div className="modal-body">
                                <div className="target-selector">
                                    <p className="form-label" style={{ marginBottom: 8, fontSize: '0.85rem' }}>Select Recipients</p>
                                    
                                    {user?.role === 'ADMIN' && (
                                        <div 
                                            className={`target-option ${broadcastTarget === 'ALL_STUDENTS' ? 'active' : ''}`}
                                            onClick={() => setBroadcastTarget('ALL_STUDENTS')}
                                        >
                                            <div className="target-option-icon"><Users size={18} /></div>
                                            <div className="target-option-info">
                                                <span className="target-option-title">All Students</span>
                                                <span className="target-option-desc">Send to every active student in the institution.</span>
                                            </div>
                                        </div>
                                    )}

                                    <div 
                                        className={`target-option ${broadcastTarget === 'COURSE_STUDENTS' ? 'active' : ''}`}
                                        onClick={() => setBroadcastTarget('COURSE_STUDENTS')}
                                    >
                                        <div className="target-option-icon"><Book size={18} /></div>
                                        <div className="target-option-info">
                                            <span className="target-option-title">Course Registered Students</span>
                                            <span className="target-option-desc">Target students enrolled in a specific course.</span>
                                        </div>
                                    </div>
                                </div>

                                {broadcastTarget === 'COURSE_STUDENTS' && (
                                    <div className="form-group">
                                        <label>Select Course</label>
                                        <select 
                                            required 
                                            value={broadcastCourseId} 
                                            onChange={e => setBroadcastCourseId(e.target.value)}
                                            style={{ width: '100%', padding: '10px' }}
                                        >
                                            <option value="">Choose a course...</option>
                                            {myCourses.map(c => (
                                                <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                                            ))}
                                        </select>
                                        {myCourses.length === 0 && (
                                            <p style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: 4 }}>
                                                You are not assigned to any courses.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label>Message Content</label>
                                    <textarea 
                                        required
                                        rows={4}
                                        placeholder="Type your message here..."
                                        value={broadcastContent}
                                        onChange={e => setBroadcastContent(e.target.value)}
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                    />
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                        Note: Students currently in an active exam period will not receive this message until after their exam.
                                    </p>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowBroadcastModal(false)} disabled={broadcasting}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={broadcasting || !broadcastContent.trim() || (broadcastTarget === 'COURSE_STUDENTS' && !broadcastCourseId)}>
                                    {broadcasting ? 'Sending...' : 'Send Broadcast'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Simple local component for the placeholder icon since we don't have it imported at top
function MessageIcon({ size, style }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"></path>
        </svg>
    )
}
