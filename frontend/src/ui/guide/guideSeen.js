// Which page guides someone has already seen (or dismissed), in this browser only. The (?) button pulses
// on a page until its guide is seen. Storage may be blocked (private mode): then it just pulses again.
const keyFor = (userId, guideId) => `oops-guide:${userId ?? 'anon'}:${guideId}`;

export function guideSeen(userId, guideId) {
    try {
        return localStorage.getItem(keyFor(userId, guideId)) === '1';
    } catch {
        return true; // can't remember: don't nag
    }
}

export function markGuideSeen(userId, guideId) {
    try {
        localStorage.setItem(keyFor(userId, guideId), '1');
    } catch {
        // not remembered; fine
    }
}
