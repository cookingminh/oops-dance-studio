import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuChevronLeft, LuChevronRight, LuDownload, LuReceipt } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { nextMonth, prevMonth } from '@/lib/lessons';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import CountUp from '../../common/CountUp';
import { EASE_OUT } from '../../common/motion';
import { capitalizeFirst } from './tuitionModel';

const RING = 2 * Math.PI * 42;

// Collection rate as a ring meter: the green fill is what came in, the pale track what was billed.
const CollectionRing = ({ rate }) => {
    const { t } = useI18n();
    const pct = rate === null ? null : Math.round(rate * 100);
    return (
        <svg className="tuRing" viewBox="0 0 100 100" role="img" aria-label={pct === null ? t('Nothing billed yet') : t('{pct}% collected', { pct })}>
            <circle cx="50" cy="50" r="42" className="tuRingTrack" />
            <motion.circle
                cx="50"
                cy="50"
                r="42"
                className="tuRingFill"
                strokeDasharray={RING}
                initial={{ strokeDashoffset: RING }}
                animate={{ strokeDashoffset: RING * (1 - Math.min(rate ?? 0, 1)) }}
                transition={{ duration: 1, ease: EASE_OUT }}
            />
            <text x="50" y="50" className="tuRingText">
                {pct === null ? '—' : `${pct}%`}
            </text>
        </svg>
    );
};

const vnd = (value) => formatVnd(value);

const VIEWS = [
    { key: 'running', label: 'Running now' },
    { key: 'next', label: 'Next courses' },
    { key: 'month', label: 'By month' },
];

// Header of the page: which invoices are on show — the courses running now (plus finished ones still
// owed), the next courses (renewals) or the courses starting in a month (history, the accountant's
// CSV) — and their money: billed, collected, still to collect and the collection rate.
const TuitionOverview = ({ view, month, thisMonth, summary, loading, onView, onPickMonth, onExport }) => {
    const { t, tn, monthName } = useI18n();
    const { counts, money } = summary;
    const monthLabel = month ? capitalizeFirst(monthName(month, { withYear: true })) : '…';
    const subtitle = {
        running: t('Courses running now, and finished courses still unpaid.'),
        next: t('The next course of each class: renewals that are open, to pay or answer.'),
        month: t('Courses that start in {month}, the month reports count them in.', { month: monthLabel }),
    }[view];
    const key = `${view}-${month}`;

    return (
        <SectionCard
            className="tuOverview"
            icon={LuReceipt}
            title={t('Tuition')}
            subtitle={subtitle}
            actions={
                <>
                    <Segmented label={t('Show')} options={VIEWS.map((option) => ({ key: option.key, label: t(option.label) }))} value={view} onChange={onView} className="tuViews" />
                    {view === 'month' && (
                        <div className="tuMonthNav" role="group" aria-label={t('Month')}>
                            <button type="button" aria-label={t('Previous month')} disabled={!month} onClick={() => onPickMonth(prevMonth(month))}>
                                <LuChevronLeft />
                            </button>
                            <span className="tuMonthName">
                                <strong>{monthLabel}</strong>
                                <small>{month === thisMonth ? t('This month') : t('Courses starting then')}</small>
                            </span>
                            <button type="button" aria-label={t('Next month')} disabled={!month || month > thisMonth} onClick={() => onPickMonth(nextMonth(month))}>
                                <LuChevronRight />
                            </button>
                        </div>
                    )}
                    <Button variant="flat" startContent={<LuDownload aria-hidden="true" />} isDisabled={!counts.all} onPress={onExport}>
                        {t('Export CSV')}
                    </Button>
                </>
            }
        >
            <div className={`tuKpis${loading ? ' isLoading' : ''}`}>
                <div className="tuKpi isRing">
                    <CollectionRing key={key} rate={money.rate} />
                    <span className="tuKpiText">
                        <span>{t('Collected')}</span>
                        <strong>{vnd(money.collected)}</strong>
                        <small>{t('of {amount} billed', { amount: vnd(money.billed) })}</small>
                    </span>
                </div>
                <div className="tuKpi">
                    <span>{t('Billed')}</span>
                    <strong>
                        <CountUp key={key} value={money.billed} format={vnd} />
                    </strong>
                    <small>{tn(counts.all, '{count} invoice', '{count} invoices')}</small>
                </div>
                <div className="tuKpi isGood">
                    <span>{t('Paid')}</span>
                    <strong>
                        {counts.paid} <small className="tuOf">/ {counts.all}</small>
                    </strong>
                    <small>{t('Transfer {transfer} · cash {cash}', { transfer: vnd(money.transfer), cash: vnd(money.cash) })}</small>
                </div>
                <div className={`tuKpi${money.overdue ? ' isBad' : ''}`}>
                    <span>{t('Still to collect')}</span>
                    <strong>
                        <CountUp key={key} value={money.outstanding} format={vnd} />
                    </strong>
                    <small>{t('{due} due · {overdue} overdue', { due: counts.due, overdue: counts.overdue })}</small>
                </div>
                <div className="tuKpi isQuiet">
                    <span>{t('Waived · cancelled')}</span>
                    <strong>
                        {counts.waived} · {counts.void}
                    </strong>
                    <small>{money.waived ? t('{amount} waived', { amount: vnd(money.waived) }) : t('Nothing waived')}</small>
                </div>
            </div>
        </SectionCard>
    );
};

export default TuitionOverview;
