import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LuListFilter } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { getActivitySummary } from '@/services/activity';
import { getStudioToday } from '@/services/studio';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard from '../../common/SectionCard';
import { PERIOD_PARAMS, feedQuery, hasFilters, periodRange, readFilters } from './activityModel';
import { countActivity, loadLookups } from './activityQueries';
import { useActivityFeed, useActivityFormat } from './useActivityFeed';
import ActivityOverview from './ActivityOverview';
import ActivityToolbar from './ActivityToolbar';
import ActivityFeed from './ActivityFeed';
import ActivityDrawer from './ActivityDrawer';
import './activity.scss';

const nothing = () => Promise.resolve(undefined);
const URL_KEYS = { person: 'person', subject: 'subject', area: 'area', action: 'action', q: 'q', classId: 'class' };

// The day headers stick right under the workspace's top bar, whatever its height.
function useTopBarHeight() {
    const [height, setHeight] = useState(0);
    useLayoutEffect(() => {
        const bar = document.querySelector('.adminTopBar');
        if (!bar) return undefined;
        const update = () => setHeight(bar.offsetHeight);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(bar);
        return () => observer.disconnect();
    }, []);
    return height;
}

// /admin/activity (admins): who did what at the studio, and when. The period and the filters
// live in the URL, so other pages can link to a person's, a student's or a class's activity.
const Activity = () => {
    const { t, tn } = useI18n();
    const [params, setParams] = useSearchParams();
    const today = useAsync(getStudioToday, []);
    const lookups = useAsync(loadLookups, []);
    const fmt = useActivityFormat(lookups.data);
    const filters = readFilters(params);
    const range = today.data ? periodRange(params, today.data) : null;
    const summary = useAsync(() => (range ? getActivitySummary(range.from, range.to) : nothing()), [range?.from, range?.to]);
    const query = range ? feedQuery(filters, range) : null;
    const queryKey = JSON.stringify(query);
    const filtered = hasFilters(filters);
    const feed = useActivityFeed(query, range?.includesToday);
    const matching = useAsync(() => (query && filtered ? countActivity(query) : nothing()), [queryKey, filtered]);
    const [open, setOpen] = useState(null); // the row in the drawer
    const [refreshing, setRefreshing] = useState(false);
    const top = useTopBarHeight();

    // Search waits for a pause in typing before it touches the URL (and the database).
    const [search, setSearch] = useState(filters.q);
    const typed = useRef(filters.q);
    useEffect(() => {
        if (filters.q !== typed.current) setSearch((typed.current = filters.q));
    }, [filters.q]);

    const update = (patch) =>
        setParams(
            (old) => {
                const next = new URLSearchParams(old);
                for (const [key, value] of Object.entries(patch)) {
                    const name = URL_KEYS[key] ?? key;
                    if (value === null || value === undefined || value === '') next.delete(name);
                    else next.set(name, String(value));
                }
                if ('area' in patch) next.delete('action');
                return next;
            },
            { replace: true }
        );

    useEffect(() => {
        if (search === typed.current) return undefined;
        const timer = setTimeout(() => {
            typed.current = search;
            update({ q: search }); // trimmed by the query; trimming here would eat the space being typed
        }, 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    // New entries from the minute-by-minute refresh bring the counts along.
    const { reload: reloadSummary } = summary;
    const { reload: reloadMatching } = matching;
    useEffect(() => {
        if (!feed.fresh.size) return;
        reloadSummary();
        reloadMatching();
    }, [feed.fresh, reloadSummary, reloadMatching]);

    const setPeriod = (key) => {
        const patch = Object.fromEntries(PERIOD_PARAMS.map((name) => [name, null]));
        if (key === 'custom') Object.assign(patch, { from: range.fromDate, to: range.toDate });
        else if (key !== 'week') patch.period = key;
        update(patch);
    };
    const setRange = (from, to) => update({ ...Object.fromEntries(PERIOD_PARAMS.map((name) => [name, null])), from, to });
    const clearFilters = () => {
        typed.current = '';
        setSearch('');
        update({ person: null, subject: null, area: null, action: null, q: null, classId: null });
    };
    const refresh = async () => {
        setRefreshing(true);
        await Promise.all([feed.pull(), reloadSummary(), reloadMatching()]);
        setRefreshing(false);
    };

    const people = lookups.data?.people;
    const narrowed = Boolean(filters.person || filters.subject || filters.classId || filters.q.trim());
    // The phone sheet's badge counts what's inside it; the chips and search show themselves.
    const sheetCount = [filters.person, filters.area, filters.action].filter(Boolean).length;
    const chips = [
        filters.classId && {
            key: 'class',
            label: t('Class: {name}', { name: lookups.data?.classes.get(filters.classId) ?? `#${filters.classId}` }),
            onRemove: () => update({ classId: null }),
        },
        filters.subject && {
            key: 'subject',
            label: t('About: {name}', { name: people?.get(filters.subject)?.name ?? t('someone') }),
            onRemove: () => update({ subject: null }),
        },
    ].filter(Boolean);

    if (!range) {
        return (
            <SectionCard>
                <AsyncState state={today} isEmpty={false}>
                    {null}
                </AsyncState>
            </SectionCard>
        );
    }

    return (
        <>
            <ActivityOverview
                range={range}
                today={today.data}
                summary={summary}
                lookups={lookups.data}
                filters={filters}
                narrowed={narrowed}
                live={range.includesToday}
                updatedAt={feed.updatedAt}
                refreshing={refreshing}
                onPeriod={setPeriod}
                onRange={setRange}
                onPerson={(person) => update({ person })}
                onArea={(area) => update({ area })}
                onRefresh={refresh}
            />

            <SectionCard
                className="alogFeedCard"
                icon={LuListFilter}
                title={t('Timeline')}
                subtitle={
                    filtered && matching.data !== undefined
                        ? tn(matching.data, '{count} entry matches these filters', '{count} entries match these filters')
                        : t('Newest first. Open an entry to see exactly what changed.')
                }
                style={{ '--alog-top': `${top}px` }}
            >
                <ActivityToolbar
                    filters={filters}
                    search={search}
                    onSearch={setSearch}
                    summary={summary.data}
                    lookups={lookups.data}
                    narrowed={narrowed}
                    sheetCount={sheetCount}
                    filtered={filtered}
                    chips={chips}
                    onFilter={update}
                    onClear={clearFilters}
                />
                <ActivityFeed
                    feed={feed}
                    fmt={fmt}
                    today={today.data}
                    periodKey={range.key}
                    filtered={filtered}
                    onOpen={setOpen}
                    onClear={clearFilters}
                    onPeriod={setPeriod}
                />
            </SectionCard>

            {open && <ActivityDrawer row={open} fmt={fmt} lookups={lookups.data} onPick={setOpen} onClose={() => setOpen(null)} />}
        </>
    );
};

export default Activity;
