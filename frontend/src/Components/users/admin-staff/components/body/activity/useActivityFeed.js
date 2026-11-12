import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listActivity } from '@/services/activity';
import { toAppError } from '@/services/errors';
import { useI18n } from '@/i18n/i18nContext';

const REFRESH_EVERY = 60_000;
const EMPTY = { rows: [], hasMore: false, loading: true, error: null, loadingMore: false, fresh: new Set(), updatedAt: null };

// The feed for one set of filters: the first page, "load more" (cursor) and pulling in what's new.
// While `live` (the period includes today) it pulls every minute when the tab is visible; rows that
// arrive that way are listed in `fresh` so they can slide in.
export function useActivityFeed(query, live) {
    const key = query ? JSON.stringify(query) : null;
    const [state, setState] = useState(EMPTY);
    const latest = useRef({ call: 0, rows: [] });
    latest.current.rows = state.rows;

    const load = useCallback(async () => {
        if (!key) return;
        const call = ++latest.current.call;
        setState((old) => ({ ...old, loading: true, error: null }));
        try {
            const { rows, hasMore } = await listActivity(JSON.parse(key));
            if (call === latest.current.call) setState({ ...EMPTY, rows, hasMore, loading: false, updatedAt: Date.now() });
        } catch (error) {
            if (call === latest.current.call) setState((old) => ({ ...old, loading: false, error: toAppError(error) }));
        }
    }, [key]);

    useEffect(() => {
        setState(EMPTY);
        load();
    }, [load]);

    const loadMore = useCallback(async () => {
        const last = latest.current.rows.at(-1);
        if (!key || !last) return;
        const call = latest.current.call;
        setState((old) => ({ ...old, loadingMore: true }));
        try {
            const { rows, hasMore } = await listActivity({ ...JSON.parse(key), before: { at: last.at, id: last.id } });
            if (call !== latest.current.call) return;
            setState((old) => {
                const known = new Set(old.rows.map((row) => row.id));
                return { ...old, rows: [...old.rows, ...rows.filter((row) => !known.has(row.id))], hasMore, loadingMore: false };
            });
        } catch (error) {
            if (call === latest.current.call) setState((old) => ({ ...old, loadingMore: false, error: toAppError(error) }));
        }
    }, [key]);

    // Only what's newer than the top row; a big jump reloads the whole first page instead.
    const pull = useCallback(async () => {
        const newest = latest.current.rows[0];
        if (!key) return;
        if (!newest) return load();
        const call = latest.current.call;
        try {
            const { rows, hasMore } = await listActivity({ ...JSON.parse(key), from: newest.at });
            if (call !== latest.current.call) return;
            if (hasMore) return load();
            setState((old) => {
                const known = new Set(old.rows.map((row) => row.id));
                const added = rows.filter((row) => !known.has(row.id));
                return { ...old, rows: [...added, ...old.rows], fresh: new Set(added.map((row) => row.id)), updatedAt: Date.now() };
            });
        } catch {
            // A missed refresh is retried a minute later.
        }
    }, [key, load]);

    useEffect(() => {
        if (!live) return undefined;
        const timer = setInterval(() => document.visibilityState === 'visible' && pull(), REFRESH_EVERY);
        return () => clearInterval(timer);
    }, [live, pull]);

    return { ...state, reload: load, loadMore, pull };
}

// Everything a sentence needs to turn a row into words, in the current language.
export function useActivityFormat(lookups) {
    const { t, tn, formatDate, dayName, monthName, lang } = useI18n();
    return useMemo(
        () => ({ t, tn, formatDate, dayName, monthName, lang, people: lookups?.people, rooms: lookups?.rooms, venues: lookups?.venues, classes: lookups?.classes }),
        [t, tn, formatDate, dayName, monthName, lang, lookups]
    );
}
