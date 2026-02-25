import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const raw = localStorage.getItem('classify_user');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    });

    const login = useCallback(async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('classify_token', data.token);
        localStorage.setItem('classify_user', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(async () => {
        try { await api.post('/auth/logout'); } catch { }
        localStorage.removeItem('classify_token');
        localStorage.removeItem('classify_user');
        setUser(null);
    }, []);

    const isAdmin = user?.role === 'ADMIN';
    const isInstructor = user?.role === 'INSTRUCTOR';
    const isStudent = user?.role === 'STUDENT';

    return (
        <AuthContext.Provider value={{ user, login, logout, isAdmin, isInstructor, isStudent }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};
