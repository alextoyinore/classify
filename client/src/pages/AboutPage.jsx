import React from 'react';
import { Info, Shield, Users, BookOpen, GraduationCap } from 'lucide-react';

export default function AboutPage() {
    return (
        <div className="about-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">About Classify</h1>
                    <p className="page-subtitle">Your Comprehensive University Management System</p>
                </div>
            </div>

            <div className="grid grid-2 gap-24 mt-24">
                <div className="card">
                    <div className="flex items-center gap-12 mb-16">
                        <div className="stat-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                            <GraduationCap size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Our Mission</h2>
                    </div>
                    <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                        Classify is designed to streamline academic operations, empower educators, and enhance the student learning experience. We provide a single, unified platform for managing courses, tracking attendance, administering computer-based tests (CBT), and processing results.
                    </p>
                </div>

                <div className="card">
                    <div className="flex items-center gap-12 mb-16">
                        <div className="stat-icon" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
                            <Shield size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Secure & Reliable</h2>
                    </div>
                    <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                        Built with modern web technologies, Classify ensures that academic data is secure, highly available, and easily accessible across devices. With real-time syncing and robust role-based access control, institutional data remains protected.
                    </p>
                </div>

                <div className="card">
                    <div className="flex items-center gap-12 mb-16">
                        <div className="stat-icon" style={{ background: 'var(--amber-dim)', color: 'var(--amber)' }}>
                            <Users size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>For Everyone</h2>
                    </div>
                    <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                        Whether you are an administrator managing the academic structure, an instructor tracking student progress, or a student reviewing your results, Classify provides tailored interfaces to make your academic life easier.
                    </p>
                </div>

                <div className="card">
                    <div className="flex items-center gap-12 mb-16">
                        <div className="stat-icon" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                            <BookOpen size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Continuous Innovation</h2>
                    </div>
                    <p className="text-secondary" style={{ lineHeight: 1.6 }}>
                        We are constantly evolving to meet the needs of modern educational institutions. From seamless offline capabilities via PWA technology to advanced CBT analytics, Classify represents the future of university management.
                    </p>
                </div>
            </div>

            <div className="card mt-24" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 12 }}>Version 1.0.0</h2>
                <p className="text-secondary">© {new Date().getFullYear()} Classify Solutions. All rights reserved.</p>
            </div>
        </div>
    );
}
