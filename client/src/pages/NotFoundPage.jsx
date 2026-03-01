import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, color: 'var(--amber, #f59e0b)' }}>
                <AlertTriangle size={80} />
            </div>
            <h1 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: 16, color: 'var(--text-main, #111827)' }}>404</h1>
            <h2 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: 16, color: 'var(--text-main, #111827)' }}>Page Not Found</h2>
            <p className="text-secondary" style={{ marginBottom: 32, lineHeight: 1.6, maxWidth: 500, fontSize: '1.1rem' }}>
                Oops! The page you are looking for doesn't exist, has been moved, or is temporarily unavailable.
            </p>
            <Link to="/dashboard" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: '1.1rem' }}>
                <Home size={20} />
                Back to Dashboard
            </Link>
        </div>
    );
}
