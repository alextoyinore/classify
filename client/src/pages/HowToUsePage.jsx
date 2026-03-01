import React, { useState } from 'react';
import { BookOpen, Users, GraduationCap, ChevronDown, ChevronRight } from 'lucide-react';

const sections = [
    {
        id: 'admin',
        title: 'For Administrators',
        icon: Users,
        color: 'var(--danger)',
        bgColor: 'var(--danger-dim)',
        content: [
            {
                subtitle: 'Academic Structure & Sessions',
                text: 'Navigate to "Academic Structure" to manage Faculties and Departments. Use "Academic Sessions" to define the current school year and active semester. Changing the active session will globally affect attendance and exam availability.'
            },
            {
                subtitle: 'User Management',
                text: 'Manage Students and Instructors from the "People" section. You can register new users, assign instructors to specific courses, and manage their profiles. Deactivating a user revokes their login access immediately.'
            },
            {
                subtitle: 'Course Management',
                text: 'Create and manage courses under the "Courses" tab. You can assign credit units, specify the intended level, and assign primary instructors. Courses form the backbone for attendance, exams, and results.'
            },
            {
                subtitle: 'System Configuration',
                text: 'Under "Settings", configure the institution name, logo, global attendance weight, and exam deletion grace periods. Ensure the "Cloud Sync" is working if your institution requires external data backups.'
            }
        ]
    },
    {
        id: 'instructor',
        title: 'For Instructors',
        icon: BookOpen,
        color: 'var(--accent)',
        bgColor: 'var(--accent-dim)',
        content: [
            {
                subtitle: 'Managing Attendance',
                text: 'Go to the "Attendance" page. Select your assigned course and generate a 6-digit session pin. Students will use this pin to self-mark their attendance from their dashboard. You can also manually mark students present or absent.'
            },
            {
                subtitle: 'Creating Exams (CBT)',
                text: 'Use the "Question Bank" to author computer-based tests. You can add questions, set time limits, and publish the exam. Make sure the exam date falls within the active semester.'
            },
            {
                subtitle: 'Class Library',
                text: 'Upload lecture notes, PDFs, and slide decks in the "Class Library". These materials will automatically become available to all students enrolled in your course.'
            },
            {
                subtitle: 'Messages',
                text: 'Communicate directly with your students via the "Messages" tab. You can set up a secure PIN to lock your messages for added privacy if you step away from your device.'
            }
        ]
    },
    {
        id: 'student',
        title: 'For Students',
        icon: GraduationCap,
        color: 'var(--success)',
        bgColor: 'var(--success-dim)',
        content: [
            {
                subtitle: 'Dashboard & Attendance',
                text: 'Your dashboard summarizes your active courses. When an instructor opens an attendance session, it will pop up on your dashboard and profile. Enter the provided PIN to mark yourself present.'
            },
            {
                subtitle: 'Taking Exams',
                text: 'Navigate to "My Exams" under CBT to see your upcoming tests. Exams are strictly timed. Ensure you have a stable connection, though the system will attempt to reconnect gracefully if interrupted.'
            },
            {
                subtitle: 'Viewing Results',
                text: 'Check "My Results" to see your performance across semesters. The system automatically calculates your GPA based on course units and your accumulated scores (including attendance weight).'
            },
            {
                subtitle: 'Accessing Materials',
                text: 'Go to the "Class Library" to download materials uploaded by your instructors. These are organized by course for easy access.'
            }
        ]
    }
];

export default function HowToUsePage() {
    const [openSection, setOpenSection] = useState('student');

    return (
        <div className="how-to-use-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">How to Use Classify</h1>
                    <p className="page-subtitle">Comprehensive guides for all user roles</p>
                </div>
            </div>

            <div className="mt-24 flex flex-col gap-16">
                {sections.map((sec) => (
                    <div key={sec.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <button
                            className="w-full flex items-center justify-between"
                            style={{ padding: '20px 24px', background: openSection === sec.id ? 'var(--bg-body)' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                            onClick={() => setOpenSection(openSection === sec.id ? null : sec.id)}
                        >
                            <div className="flex items-center gap-16">
                                <div className="stat-icon" style={{ background: sec.bgColor, color: sec.color }}>
                                    <sec.icon size={24} />
                                </div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>{sec.title}</h2>
                            </div>
                            {openSection === sec.id ? <ChevronDown size={20} className="text-muted" /> : <ChevronRight size={20} className="text-muted" />}
                        </button>

                        {openSection === sec.id && (
                            <div style={{ padding: '0 24px 24px', borderTop: '1px solid var(--border)' }}>
                                <div className="grid grid-2 gap-24 mt-24">
                                    {sec.content.map((item, i) => (
                                        <div key={i}>
                                            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
                                                {item.subtitle}
                                            </h3>
                                            <p className="text-secondary" style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>
                                                {item.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
