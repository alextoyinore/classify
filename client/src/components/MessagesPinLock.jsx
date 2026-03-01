import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import './MessagesPinLock.css';

/**
 * Shown when the messages page is locked.
 * Props:
 *  - onUnlock(pin): called with the entered PIN; parent verifies it
 *  - hasPin: boolean — whether a PIN is already set (vs first-time setup)
 *  - onCancel: called if user dismisses (navigates away)
 */
export default function MessagesPinLock({ onUnlock, hasPin, onCancel }) {
    const [digits, setDigits] = useState('');
    const [error, setError] = useState('');

    const handleDigit = (d) => {
        if (digits.length >= 6) return;
        const next = digits + d;
        setDigits(next);
        setError('');
        if (next.length === 4) {
            // Auto-submit on 4 digits
            setTimeout(() => {
                const ok = onUnlock(next);
                if (!ok) {
                    setError('Incorrect PIN. Try again.');
                    setDigits('');
                }
            }, 150);
        }
    };

    const handleBackspace = () => {
        setDigits(d => d.slice(0, -1));
        setError('');
    };

    return (
        <div className="pin-lock-overlay">
            <div className="pin-lock-card">
                <div className="pin-lock-icon">
                    <Lock size={28} />
                </div>
                <h2 className="pin-lock-title">Messages Locked</h2>
                <p className="pin-lock-subtitle">
                    {hasPin ? 'Enter your 4-digit PIN to continue' : 'Enter a 4-digit PIN to unlock'}
                </p>

                {/* Dot display */}
                <div className="pin-dots">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`pin-dot ${i < digits.length ? 'filled' : ''}`} />
                    ))}
                </div>

                {error && <p className="pin-error">{error}</p>}

                {/* Number pad */}
                <div className="pin-pad">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                        <button key={n} className="pin-key" onClick={() => handleDigit(String(n))}>
                            {n}
                        </button>
                    ))}
                    <button className="pin-key pin-key-empty" disabled />
                    <button className="pin-key" onClick={() => handleDigit('0')}>0</button>
                    <button className="pin-key pin-key-back" onClick={handleBackspace}>⌫</button>
                </div>

                {onCancel && (
                    <button className="pin-cancel" onClick={onCancel}>
                        <X size={14} /> Cancel
                    </button>
                )}
            </div>
        </div>
    );
}
