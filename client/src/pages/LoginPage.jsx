import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api';

export default function LoginPage() {
    const { login } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [isSignup, setIsSignup] = useState(false);

    const [form, setForm] = useState({
        identifier: '', // Dual-purpose for Email or Matric
        password: '',
        fullName: '',
        matricNumber: ''
    });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isSignup) {
                await api.post('/auth/register', {
                    password: form.password,
                    fullName: form.fullName,
                    matricNumber: form.matricNumber
                });
                toast('Registration successful! Please sign in.');
                setIsSignup(false);
                setForm(f => ({ ...f, password: '', fullName: '', matricNumber: '', identifier: f.matricNumber }));
            } else {
                await login(form.identifier, form.password);
                toast('Welcome back!');
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Action failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className={`login-card ${isSignup ? 'signup-mode' : ''}`}>
                <div className="login-logo">
                    <GraduationCap size={40} className="text-accent" />
                    <span>Classify</span>
                </div>
                <h1 className="login-title">{isSignup ? 'Create Account' : 'Welcome Back'}</h1>
                <p className="login-subtitle">
                    {isSignup ? 'Register as a student in seconds' : 'Sign in to access your portal'}
                </p>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && <div className="error-msg">{error}</div>}

                    {isSignup ? (
                        <>
                            <div className="form-group">
                                <label>Full Name</label>
                                <input
                                    placeholder="John Doe"
                                    value={form.fullName}
                                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Matric Number</label>
                                <input
                                    placeholder="CSC/21/001"
                                    value={form.matricNumber}
                                    onChange={e => setForm(f => ({ ...f, matricNumber: e.target.value }))}
                                    required
                                />
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <label>Email or Matric Number</label>
                            <input
                                placeholder="name@uni.edu or CSC/21/001"
                                value={form.identifier}
                                onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                                required
                                autoFocus
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPw ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(v => !v)}
                                className="pw-toggle"
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    color: 'var(--text-muted)'
                                }}
                            >
                                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full mt-8"
                        disabled={loading}
                    >
                        {loading ? 'Processing…' : isSignup ? 'Create Account' : 'Sign In'}
                    </button>
                </form>

                <div className="signup-switch">
                    <span>{isSignup ? 'Already have an account?' : "Don't have an account?"}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsSignup(!isSignup);
                            setError('');
                        }}
                    >
                        {isSignup ? 'Sign In' : 'Sign Up as Student'}
                    </button>
                </div>

                <p className="login-footer">
                    Classify — Lightweight campus management
                </p>
            </div>
        </div>
    );
}
