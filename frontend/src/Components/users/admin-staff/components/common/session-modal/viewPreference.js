// The calendar view (week / month) each page last showed, remembered in this browser only.
const KEY = (page) => `oops-calendar-view:${page}`;

export function readView(page, fallback) {
    try {
        const saved = window.localStorage.getItem(KEY(page));
        return saved === 'week' || saved === 'month' ? saved : fallback;
    } catch {
        return fallback;
    }
}

export function rememberView(page, view) {
    try {
        window.localStorage.setItem(KEY(page), view);
    } catch {
        // Private mode or blocked storage: the choice just isn't remembered.
    }
}
