import { useEffect, useMemo, useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuCalendarRange, LuChevronDown, LuFilterX, LuInbox } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import { collapse, groupByDay, shiftDay } from './activityModel';
import ActivityEntry from './ActivityEntry';

// "Today · Tue 10 Nov", "Yesterday · Mon 9 Nov", "Sunday 8 November".
function useDayLabel(today) {
    const { t, formatDate } = useI18n();
    return (date) => {
        if (date === today) return t('Today · {date}', { date: formatDate(date, 'short') });
        if (date === shiftDay(today, -1)) return t('Yesterday · {date}', { date: formatDate(date, 'short') });
        return formatDate(date, date.slice(0, 4) === today.slice(0, 4) ? 'long' : 'full');
    };
}

// Placeholder rows while the first page loads.
export const FeedSkeleton = () => (
    <div className="alogSkeleton" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="alogSkeletonRow">
                <span className="alogSkelCircle" />
                <span className="alogSkelLines">
                    <span style={{ width: `${62 - index * 5}%` }} />
                    <span style={{ width: `${34 + index * 3}%` }} />
                </span>
            </div>
        ))}
    </div>
);

const EmptyFeed = ({ filtered, periodKey, onClear, onPeriod }) => {
    const { t } = useI18n();
    const title = filtered ? t('Nothing matches these filters') : periodKey === 'today' ? t('Nothing has happened yet today') : t('Nothing happened in this period');
    const text = filtered
        ? t('Try another person or area, or clear the filters to see everything.')
        : t('Whenever someone books, checks in, takes a roll call, records a payment or changes a class, it shows up here within a minute.');
    return (
        <div className="alogEmpty">
            <span className="alogEmptyIcon" aria-hidden="true">
                <LuInbox />
            </span>
            <strong>{title}</strong>
            <p>{text}</p>
            <div className="alogEmptyActions">
                {filtered && (
                    <Button size="sm" variant="flat" startContent={<LuFilterX aria-hidden="true" />} onPress={onClear}>
                        {t('Clear filters')}
                    </Button>
                )}
                {periodKey !== 'month' && (
                    <Button size="sm" variant="flat" startContent={<LuCalendarRange aria-hidden="true" />} onPress={() => onPeriod('month')}>
                        {t('Show this month')}
                    </Button>
                )}
            </div>
        </div>
    );
};

// The timeline: one block per day with a sticky header, newest first; bursts collapsed.
const ActivityFeed = ({ feed, fmt, today, periodKey, filtered, onOpen, onClear, onPeriod }) => {
    const { t, tn } = useI18n();
    const dayLabel = useDayLabel(today);
    const days = useMemo(() => groupByDay(collapse(feed.rows)), [feed.rows]);

    // Re-render every 30 s so "5 minutes ago" stays true.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => setNow(Date.now()), [feed.rows]);

    if (feed.error && !feed.rows.length) return <ErrorMessage error={feed.error} onRetry={feed.reload} />;
    if (feed.loading && !feed.rows.length) return <FeedSkeleton />;
    if (!feed.rows.length) return <EmptyFeed filtered={filtered} periodKey={periodKey} onClear={onClear} onPeriod={onPeriod} />;

    return (
        <div className={`alogFeed${feed.loading ? ' isReloading' : ''}`} aria-busy={feed.loading}>
            {days.map((day, index) => {
                const partial = feed.hasMore && index === days.length - 1;
                return (
                    <section key={day.date} className="alogDay" aria-labelledby={`alog-day-${day.date}`}>
                        <h3 className="alogDayHead" id={`alog-day-${day.date}`}>
                            <span>{dayLabel(day.date)}</span>
                            <small>{partial ? t('{count}+ actions', { count: day.count }) : tn(day.count, '{count} action', '{count} actions')}</small>
                        </h3>
                        <ul className="alogList">
                            {day.items.map((item) => (
                                <ActivityEntry
                                    key={item.id}
                                    item={item}
                                    fmt={fmt}
                                    now={now}
                                    fresh={(item.kind === 'burst' ? item.rows : [item.row]).some((row) => feed.fresh.has(row.id))}
                                    onOpen={onOpen}
                                />
                            ))}
                        </ul>
                    </section>
                );
            })}
            <div className="alogMore">
                {feed.hasMore ? (
                    <Button variant="flat" startContent={feed.loadingMore ? null : <LuChevronDown aria-hidden="true" />} isLoading={feed.loadingMore} onPress={feed.loadMore}>
                        {t('Load more')}
                    </Button>
                ) : (
                    <p>{t('That’s everything in this period.')}</p>
                )}
            </div>
        </div>
    );
};

export default ActivityFeed;
