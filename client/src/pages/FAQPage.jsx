import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';

const faqs = [
    {
        question: 'How do I reset my password?',
        answer: 'You can change your password by navigating to your "My Profile" page and scrolling to the "Security Settings" section. If you forget your password entirely, please contact your system administrator to issue a temporary reset.'
    },
    {
        question: 'What happens if my network disconnects during a CBT exam?',
        answer: 'The system automatically saves your answers continuously as you interact with the test. If your network drops, your progress up to your last action is saved. Refresh the page once your connection is restored to continue from where you left off, provided the time has not elapsed.'
    },
    {
        question: 'Why can\'t I see my course materials in the Class Library?',
        answer: 'Course materials are linked to specific courses. Ensure you are correctly registered for the course. If the issue persists, your instructor may not have uploaded the materials for that particular course yet.'
    },
    {
        question: 'How does the attendance system calculate my score?',
        answer: 'Your attendance score is calculated based on the total number of classes held versus how many you attended. This percentage is then scaled against the "Attendance Weight" defined by the administration (e.g., 10 marks max).'
    },
    {
        question: 'Can I change my profile picture?',
        answer: 'Yes! Go to "My Profile", and under "Profile Information", click the "Change Avatar" button to upload a new JPG, PNG, or GIF image.'
    },
    {
        question: 'Why did my Messages page lock itself?',
        answer: 'For your privacy, if you set a Messages PIN, the app will automatically lock the messages view after 1 minute of inactivity or if you navigate to another page. Enter your 4-digit PIN to unlock it.'
    },
    {
        question: 'Is it possible to install this app on my phone?',
        answer: 'Yes! Classify is a Progressive Web App (PWA). If you open the site in Chrome, Edge, or Safari, you will see an option to "Install" or "Add to Home Screen". This allows you to launch the app directly like a native mobile app.'
    }
];

export default function FAQPage() {
    const [openIndex, setOpenIndex] = useState(null);

    return (
        <div className="faq-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Frequently Asked Questions</h1>
                    <p className="page-subtitle">Find answers to common questions about Classify</p>
                </div>
            </div>

            <div className="mt-24 flex flex-col gap-12">
                {faqs.map((faq, i) => {
                    const isOpen = openIndex === i;
                    return (
                        <div key={i} className="card" style={{
                            padding: 0,
                            borderColor: isOpen ? 'var(--accent)' : 'var(--border)',
                            transition: 'all 0.2s',
                            boxShadow: isOpen ? '0 4px 12px rgba(37, 99, 235, 0.08)' : '0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                            <button
                                className="w-full flex items-center justify-between"
                                style={{
                                    padding: '20px 24px',
                                    background: isOpen ? 'var(--accent-dim)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    borderRadius: isOpen ? '12px 12px 0 0' : '12px',
                                    transition: 'background 0.2s'
                                }}
                                onClick={() => setOpenIndex(isOpen ? null : i)}
                            >
                                <div className="flex items-center gap-16">
                                    <div className="stat-icon" style={{
                                        width: 32, height: 32,
                                        background: isOpen ? 'white' : 'var(--accent-dim)',
                                        color: 'var(--accent)'
                                    }}>
                                        <HelpCircle size={18} />
                                    </div>
                                    <span style={{
                                        fontSize: '1.05rem',
                                        fontWeight: 600,
                                        color: isOpen ? 'var(--accent-dark)' : 'var(--text)'
                                    }}>
                                        {faq.question}
                                    </span>
                                </div>
                                <div style={{
                                    transition: 'transform 0.2s',
                                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    color: isOpen ? 'var(--accent)' : 'var(--text-muted)'
                                }}>
                                    <ChevronDown size={20} />
                                </div>
                            </button>

                            {isOpen && (
                                <div style={{
                                    padding: '0 24px 24px 72px',
                                    color: 'var(--text-secondary)',
                                    lineHeight: 1.6,
                                    fontSize: '0.95rem',
                                    borderTop: '1px solid var(--border)',
                                    marginTop: -1,
                                    animation: 'fadeInDown 0.2s ease-out'
                                }}>
                                    <div style={{ paddingTop: 16 }}>
                                        {faq.answer}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
