import { Avatar, Button, DateRangePicker } from '@nextui-org/react';
import { parseDate } from '@internationalized/date';
import { AnimatePresence, motion } from 'framer-motion';
import { LuCpu, LuHistory, LuRefreshCw } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { formatClock } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import CountUp from '../../common/CountUp';
import { AREA_KEYS, OLDEST_DAYS, PERIODS, areaOf, shiftDay } from './activityModel';

const BUSIEST = 5;

// Area filter chips with the period's counts: the per-area breakdown and the filter in one.
// Counts are left out when other filters narrow the feed (they'd count the whole period).
export const AreaChips = ({ summary, area, showCounts, onArea }) => {
    const { t } = useI18n();
    const counts = new Map((summary?.areas ?? []).map((row) => [row.area, row.count]));
    const keys = AREA_KEYS.filter((key) => counts.has(key) || key === area);
    return (
        <div className="alogAreas" role="group" aria-label={t('Area')}>
            <button type="button" className="alogAreaChip" aria-pressed={!area} onClick={() => onArea(null)}>
                {t('All areas')}
                {showCounts && summary && <span className="segCount">{summary.total}</span>}
            </button>
            {keys.map((key) => {
                const { icon: Icon, label } = areaOf(key);
                return (
                    <button key={key} type="button" className="alogAreaChip" data-area={key} aria-pressed={area === key} onClick={() => onArea(area === key ? null : key)}>
                        <Icon aria-hidden="true" />
                        {t(label)}
                        {showCounts && <span className="segCount">{counts.get(key) ?? 0}</span>}
                    </button>
                );
            })}
        </div>
    );
};

// The busiest people of the period; pressing one shows only what they did.
const Busiest = ({ people, lookups, person, onPerson }) => {
    const { t } = useI18n();
    if (!people.length) return null;
    return (
        <div className="alogBusiest">
            <span className="alogLabel">{t('Busiest')}</span>
            <ul>
                {people.slice(0, BUSIEST).map((row) => {
                    const id = row.actor_id ?? 'system';
                    const profile = lookups?.people?.get(row.actor_id);
                    const name = row.actor_id ? profile?.name || row.name || t('Someone') : t('System');
                    return (
                        <li key={id}>
                            <button type="button" className="alogPersonPill" aria-pressed={person === id} onClick={() => onPerson(person === id ? null : id)}>
                                {row.actor_id ? (
                                    <Avatar {...AVATAR_DEFAULTS} size="sm" className="alogPillAvatar" src={avatarUrl(profile?.avatar_path, profile?.updated_at) ?? undefined} name={name} />
                                ) : (
                                    <span className="alogPillAvatar alogSystem" aria-hidden="true">
                                        <LuCpu />
                                    </span>
                                )}
                                <span className="alogPillName">{name}</span>
                                <span className="segCount">{row.count}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

// Header card: the period, a refresh, and the period at a glance (total, busiest people, areas).
const ActivityOverview = ({ range, today, summary, lookups, filters, narrowed, live, updatedAt, refreshing, onPeriod, onRange, onPerson, onArea, onRefresh }) => {
    const { t, tn, formatDate } = useI18n();
    const data = summary.data;
    const single = range.fromDate === range.toDate;
    const span = single ? formatDate(range.fromDate, 'long') : `${formatDate(range.fromDate, 'short')} – ${formatDate(range.toDate, 'short')}`;
    const title = range.key === 'custom' ? t('Custom period') : t(PERIODS.find((period) => period.key === range.key).label);

    return (
        <SectionCard
            className="alogOverview"
            icon={LuHistory}
            title={title}
            subtitle={span}
            actions={
                <div className="alogRefresh">
                    {live && (
                        <span className="alogLive" title={t('Updates every minute')}>
                            <span className="alogLiveDot" aria-hidden="true" />
                            {t('Live')}
                        </span>
                    )}
                    {updatedAt && <span className="alogUpdated">{t('Updated {time}', { time: formatClock(new Date(updatedAt).toISOString()) })}</span>}
                    <Button variant="flat" startContent={<LuRefreshCw className={refreshing ? 'alogSpin' : ''} aria-hidden="true" />} onPress={onRefresh}>
                        {t('Refresh')}
                    </Button>
                </div>
            }
        >
            <div className="alogPeriodRow">
                <Segmented
                    label={t('Period')}
                    className="alogPeriods"
                    options={PERIODS.map((period) => ({ key: period.key, label: t(period.label) }))}
                    value={range.key}
                    onChange={onPeriod}
                />
                <AnimatePresence initial={false}>
                    {range.key === 'custom' && (
                        <motion.div className="alogRange" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <DateRangePicker
                                size="sm"
                                label={t('From – to')}
                                aria-label={t('Custom period')}
                                value={{ start: parseDate(range.fromDate), end: parseDate(range.toDate) }}
                                minValue={parseDate(shiftDay(today, -OLDEST_DAYS))}
                                maxValue={parseDate(today)}
                                onChange={(value) => value?.start && value?.end && onRange(value.start.toString(), value.end.toString())}
                                classNames={{ popoverContent: 'adminPortal' }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="alogSummary">
                <div className="alogTotal" aria-live="polite">
                    <strong>{data ? <CountUp value={data.total} duration={0.8} /> : '…'}</strong>
                    {/* Filters narrow the timeline; this stays the whole studio's period. */}
                    <span>{data ? (narrowed ? tn(data.total, 'action at the studio', 'actions at the studio') : tn(data.total, 'action', 'actions')) : t('Loading…')}</span>
                </div>
                {data && <Busiest people={data.people} lookups={lookups} person={filters.person} onPerson={onPerson} />}
            </div>

            <AreaChips summary={data} area={filters.area} showCounts={!narrowed} onArea={onArea} />
        </SectionCard>
    );
};

export default ActivityOverview;
