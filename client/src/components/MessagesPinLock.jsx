import { useState, useEffect, useCallback } from 'react';
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
    const [activeKey, setActiveKey] = useState(null);

    const handleDigit = useCallback((d) => {
        setDigits(prev => {
            if (prev.length >= 4) return prev;
            const next = prev + d;
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
            return next;
        });
    }, [onUnlock]);

    const handleBackspace = useCallback(() => {
        setDigits(d => d.slice(0, -1));
        setError('');
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key >= '0' && e.key <= '9') {
                setActiveKey(e.key);
                handleDigit(e.key);
            } else if (e.key === 'Backspace') {
                setActiveKey('Backspace');
                handleBackspace();
            }
        };

        const handleKeyUp = (e) => {
            if ((e.key >= '0' && e.key <= '9') || e.key === 'Backspace') {
                setActiveKey(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleDigit, handleBackspace]);

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
                        <button
                            key={n}
                            className={`pin-key ${activeKey === String(n) ? 'active' : ''}`}
                            onClick={() => handleDigit(String(n))}
                        >
                            {n}
                        </button>
                    ))}
                    <button className="pin-key pin-key-empty" disabled />
                    <button
                        className={`pin-key ${activeKey === '0' ? 'active' : ''}`}
                        onClick={() => handleDigit('0')}
                    >
                        0
                    </button>
                    <button
                        className={`pin-key pin-key-back ${activeKey === 'Backspace' ? 'active' : ''}`}
                        onClick={handleBackspace}
                    >
                        ⌫
                    </button>
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
