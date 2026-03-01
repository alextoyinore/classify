import React from 'react';
import { ServerCrash, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ServerErrorPage() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, color: 'var(--danger, #ef4444)' }}>
                <ServerCrash size={80} />
            </div>
            <h1 style={{ fontSize: '4rem', fontWeight: 800, marginBottom: 16, color: 'var(--text-main, #111827)' }}>500</h1>
            <h2 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: 16, color: 'var(--text-main, #111827)' }}>Internal Server Error</h2>
            <p className="text-secondary" style={{ marginBottom: 32, lineHeight: 1.6, maxWidth: 500, fontSize: '1.1rem' }}>
                Oops! Something went wrong on our servers. We're working to fix the issue. Please try again later.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                    onClick={() => window.location.reload()}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: '1.1rem' }}
                >
                    <RefreshCw size={20} />
                    Reload Page
                </button>
                <Link
                    to="/dashboard"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', fontSize: '1.1rem', backgroundColor: 'var(--bg-secondary, #e5e7eb)', color: 'var(--text-main, #111827)', borderRadius: 'var(--radius, 8px)', textDecoration: 'none', fontWeight: 500 }}
                >
                    <Home size={20} />
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
