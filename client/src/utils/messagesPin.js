/**
 * useMessagesPin — manages PIN lock state for the /messages page.
 *
 * PIN is stored as a simple hash in localStorage, keyed per user.
 * Unlock state lives in sessionStorage and expires after LOCK_TIMEOUT ms.
 */

const LOCK_TIMEOUT = 60 * 1000; // 1 minute

function pinKey(userId) {
    return `classify_msg_pin_${userId}`;
}

function unlockedKey(userId) {
    return `classify_msg_unlocked_${userId}`;
}

// Very lightweight hash — good enough for a local PIN (not cryptographic)
function hashPin(pin) {
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
        hash = (hash << 5) - hash + pin.charCodeAt(i);
        hash |= 0;
    }
    return String(Math.abs(hash));
}

export function getStoredPin(userId) {
    return localStorage.getItem(pinKey(userId));
}

export function setStoredPin(userId, pin) {
    if (pin) {
        localStorage.setItem(pinKey(userId), hashPin(pin));
    } else {
        localStorage.removeItem(pinKey(userId));
    }
}

export function verifyPin(userId, attempt) {
    const stored = getStoredPin(userId);
    return stored && stored === hashPin(attempt);
}

export function markUnlocked(userId) {
    sessionStorage.setItem(unlockedKey(userId), String(Date.now()));
}

export function clearUnlocked(userId) {
    sessionStorage.removeItem(unlockedKey(userId));
}

export function isUnlocked(userId) {
    const ts = sessionStorage.getItem(unlockedKey(userId));
    if (!ts) return false;
    return Date.now() - Number(ts) < LOCK_TIMEOUT;
}

export function refreshUnlock(userId) {
    if (isUnlocked(userId)) {
        sessionStorage.setItem(unlockedKey(userId), String(Date.now()));
    }
}

export { LOCK_TIMEOUT };
