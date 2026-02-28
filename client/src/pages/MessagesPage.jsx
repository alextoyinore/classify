import { useState, useEffect, useRef } from 'react';
import { Send, User as UserIcon, AlertCircle, Clock, Search } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './MessagesPage.css';

export default function MessagesPage() {
    const { user } = useAuth();
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const pollInterval = useRef(null);

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
        // Scroll to bottom when messages change
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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
            isRead: false
        };

        // Optimistic update
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setSending(true);

        try {
            await api.post('/messages', {
                receiverId: selectedUser.id,
                content: newMsg.content
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
        if (!userSearch) return true;
        const searchLower = userSearch.toLowerCase();
        const name = String(getDisplayName(u)).toLowerCase();
        const matchRole = u.role ? String(u.role).toLowerCase() : '';
        return name.includes(searchLower) || matchRole.includes(searchLower);
    });

    return (
        <div className="messages-container">
            <div className="messages-sidebar">
                <div className="sidebar-header">
                    <h2>Messages</h2>
                    <div className="user-search-wrap">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search people..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                        />
                    </div>
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
                            <div className="chat-header-info">
                                <h3>{getDisplayName(selectedUser)}</h3>
                                {selectedUser.role === 'STUDENT' && <span className="badge badge-secondary" style={{ marginLeft: '12px' }}>Student</span>}
                                {selectedUser.role === 'ADMIN' && <span className="badge badge-primary" style={{ marginLeft: '12px' }}>Admin</span>}
                                {selectedUser.role === 'INSTRUCTOR' && <span className="badge badge-amber" style={{ marginLeft: '12px' }}>Instructor</span>}
                            </div>
                        </div>

                        <div className="chat-messages">
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
                                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                            {showDate && (
                                                <div className="chat-date-divider" style={{ alignSelf: 'center' }}>
                                                    <span>{new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                                <div className={`message-bubble ${isMe ? 'sent' : 'received'}`}>
                                                    <div className="message-content">{msg.content}</div>
                                                </div>
                                                <div className="message-meta">
                                                    {formatTime(msg.createdAt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="chat-input-area" onSubmit={handleSend}>
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
