import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowUpRight, LuCalendarDays, LuGraduationCap, LuTicket, LuWallet } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import CountUp from '../../../common/CountUp';
import { fadeUp, stagger } from '../../../common/motion';
import { useMonthFinance } from './useMonthFinance';

const STATS = [
    { key: 'monthly_booking_count', label: 'Bookings this month', icon: LuTicket, tone: 'rose', to: '/admin/bookings' },
    { key: 'total_students', label: 'Enrolled students', icon: LuGraduationCap, tone: 'violet', to: '/admin/classes' },
    { key: 'classes_today', label: 'Classes today', icon: LuCalendarDays, tone: 'amber', to: '/admin/classes' },
    { key: 'revenue_this_month', label: 'Revenue this month', icon: LuWallet, tone: 'emerald', to: '/admin/charts', format: formatVnd },
];

// Admins see the whole month's revenue (tuition + room bookings) and profit so far (after payroll
// and expenses), from the finance report, in place of the bookings-only revenue; the card opens
// /admin/reports. A month below zero so far reads as a loss, not as a negative profit.
const FINANCE_STAT = { key: 'revenue', label: 'Revenue this month', icon: LuWallet, tone: 'emerald', to: '/admin/reports', finance: true };

// dashboard_stats as four equal cards. While loading the value is a shimmer (its text "…" is hidden).
const StatCards = ({ stats }) => {
    const { t, intl } = useI18n();
    const finance = useMonthFinance();
    const cards = finance ? [...STATS.slice(0, 3), FINANCE_STAT] : STATS;

    // "27.7M ₫": a month's full revenue is too long for the card in full.
    const compact = new Intl.NumberFormat(intl === 'en-GB' ? 'en' : intl, { notation: 'compact', maximumFractionDigits: 1 });
    const short = (amount) => `${amount < 0 ? '−' : ''}${compact.format(Math.abs(amount))} ₫`;

    const valueOf = (stat) => {
        const state = stat.finance ? finance : stats;
        if (state.error) return '—';
        if (state.data === undefined) return <span className="statSkeleton">…</span>;
        return <CountUp value={Number(state.data?.[stat.key] ?? 0)} format={stat.finance ? short : stat.format} />;
    };

    return (
        <motion.section variants={fadeUp} className="statsBlock" aria-labelledby="studio-stats-title">
            <div className="blockHeader">
                <h2 id="studio-stats-title">{t('Studio Stats')}</h2>
                <span>{t('This month')}</span>
            </div>
            <motion.div className="studioStats" variants={stagger}>
                {cards.map((stat) => {
                    const Icon = stat.icon;
                    const profit = stat.finance ? finance.data?.profit : undefined;
                    return (
                        <motion.div variants={fadeUp} key={stat.key} className={`statCard tone-${stat.tone}`}>
                            <div className="statTop">
                                <span className="statIcon" aria-hidden="true">
                                    <Icon />
                                </span>
                                <Link
                                    to={stat.to}
                                    className="statLink"
                                    aria-label={stat.finance ? t('Open the finance report') : t('Open {label}', { label: t(stat.label).toLowerCase() })}
                                >
                                    <LuArrowUpRight />
                                </Link>
                            </div>
                            <span className="statValue">{valueOf(stat)}</span>
                            <span className="statLabel">{t(stat.label)}</span>
                            {stat.finance && profit !== undefined && profit !== null && (
                                <span className={`statNote${profit < 0 ? ' isLoss' : ''}`} title={t('Revenue − payroll − expenses')}>
                                    {profit < 0 ? t('Loss so far {amount}', { amount: short(-profit) }) : t('Profit so far {amount}', { amount: short(profit) })}
                                </span>
                            )}
                        </motion.div>
                    );
                })}
            </motion.div>
        </motion.section>
    );
};

export default StatCards;
