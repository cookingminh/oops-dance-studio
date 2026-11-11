// Which schedule changes a person has already seen in the bell (per person, in this browser only). A change
// counts in the badge until the bell is opened; a new reason or another make-up time counts again.

const keyFor = (userId) => `oops-seen-changes:${userId}`;

// One change → its fingerprint.
export const changeKey = (change) => [change.id, change.kind, change.date, change.start_time ?? '', change.reason ?? ''].join('|');

export function readSeen(userId) {
    try {
        const list = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '[]');
        return new Set(Array.isArray(list) ? list : []);
    } catch {
        return new Set();
    }
}

// Remembers `changes` as seen (only those still listed, so the list doesn't grow for ever).
export function markSeen(userId, changes) {
    try {
        localStorage.setItem(keyFor(userId), JSON.stringify(changes.map(changeKey)));
    } catch {
        // private mode: they count again next time, that's fine
    }
}
