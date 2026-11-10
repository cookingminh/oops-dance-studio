import { motion } from 'framer-motion';
import {
    LuArrowDown,
    LuArrowUp,
    LuBanknote,
    LuCoins,
    LuGraduationCap,
    LuHourglass,
    LuMinus,
    LuPercent,
    LuPiggyBank,
    LuReceipt,
    LuWallet,
} from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import CountUp from '../../common/CountUp';
import { fadeUp, stagger } from '../../common/motion';
import { KPIS, hasActivity, kpiDelta } from './reportModel';

const ICONS = {
    revenue: LuWallet,
    costs_total: LuBanknote,
    profit: LuPiggyBank,
    margin: LuPercent,
    collectionRate: LuReceipt,
    students_active: LuGraduationCap,
    revenuePerStudent: LuCoins,
    tuition_outstanding: LuHourglass,
};

// Change against the month before, worded as better / worse (for costs and debts, up is worse).
const Delta = ({ kpi, cur, prev, fmt }) => {
    const { t } = useI18n();
    if (cur.inProgress && kpi.flow) return <span className="kpiCompare isMuted">{t('So far, not comparable yet')}</span>;
    const delta = hasActivity(prev) ? kpiDelta(kpi, cur, prev) : null;
    if (!delta) return <span className="kpiCompare isMuted">{t('No earlier month to compare')}</span>;

    const amount = Math.abs(delta.amount);
    const change = { pct: () => fmt.pct(amount), pts: () => t('{value} pts', { value: fmt.points(amount) }), money: () => fmt.short(amount), count: () => fmt.count(amount) }[delta.mode]();
    const verdict = delta.good === null ? t('No change') : delta.good ? t('Better') : t('Worse');
    const Arrow = delta.dir === 'up' ? LuArrowUp : delta.dir === 'down' ? LuArrowDown : LuMinus;
    const tone = delta.good === null ? 'isFlat' : delta.good ? 'isBetter' : 'isWorse';

    return (
        <span className="kpiCompare">
            <span className={`kpiDelta ${tone}`}>
                <Arrow aria-hidden="true" />
                {delta.dir !== 'flat' && (
                    <>
                        <span className="sr-only">{delta.dir === 'up' ? t('Up') : t('Down')} </span>
                        {change}
                        <span aria-hidden="true"> · </span>
                    </>
                )}
                <strong>{verdict}</strong>
            </span>
            <span className="kpiVs">{t('vs {month}', { month: fmt.monthName(prev.month) })}</span>
        </span>
    );
};

// The focused month's headline numbers, each against the month before.
const KpiTiles = ({ cur, prev, openCount, fmt }) => {
    const { t, tn } = useI18n();

    const notes = {
        revenue: t('Tuition {tuition} · rooms {rooms}', { tuition: fmt.short(cur.tuition_collected), rooms: fmt.short(cur.bookings_revenue) }),
        costs_total: t('Payroll {payroll} · expenses {expenses}', { payroll: fmt.short(cur.payroll_cost), expenses: fmt.short(cur.expenses_total) }),
        profit: t('Revenue − payroll − expenses'),
        margin: t('Profit as a share of revenue'),
        collectionRate: t('{collected} of {billed} billed', { collected: fmt.short(cur.tuition_collected), billed: fmt.short(cur.tuition_billed) }),
        students_active: tn(cur.enrolments_active, '{count} class enrolment', '{count} class enrolments'),
        revenuePerStudent: t('Revenue ÷ active students'),
        tuition_outstanding: [
            openCount ? tn(openCount, '{count} open invoice', '{count} open invoices') : null,
            cur.invoices_overdue > 0 ? tn(cur.invoices_overdue, '{count} overdue', '{count} overdue') : cur.tuition_outstanding > 0 ? t('Nothing overdue') : t('All paid'),
        ]
            .filter(Boolean)
            .join(' · '),
    };

    // CountUp animates whole numbers: ratios count in tenths of a percent.
    const shown = (kpi) => {
        const value = cur[kpi.key];
        if (value === null || value === undefined) return '—';
        if (kpi.kind === 'pct') return <CountUp value={Math.round(value * 1000)} format={(v) => fmt.pct(v / 1000)} duration={0.9} />;
        if (kpi.kind === 'count') return <CountUp value={value} format={fmt.count} duration={0.9} />;
        return <CountUp value={Math.round(value)} format={fmt.money} duration={0.9} />;
    };

    return (
        <motion.ul className="kpiGrid" variants={stagger} initial="hidden" animate="show" key={cur.month}>
            {KPIS.map((kpi) => {
                const Icon = ICONS[kpi.key];
                const negative = kpi.key === 'profit' && cur.profit < 0;
                return (
                    <motion.li variants={fadeUp} key={kpi.key} className={`kpiTile${kpi.key === 'revenue' || kpi.key === 'profit' ? ' isLead' : ''}`} data-kpi={kpi.key}>
                        <span className="kpiLabel">
                            <Icon aria-hidden="true" />
                            {t(kpi.label)}
                            {negative && <span className="kpiFlag">{t('Loss')}</span>}
                        </span>
                        <strong className="kpiValue">{shown(kpi)}</strong>
                        <Delta kpi={kpi} cur={cur} prev={prev} fmt={fmt} />
                        <span className="kpiNote">{notes[kpi.key]}</span>
                    </motion.li>
                );
            })}
        </motion.ul>
    );
};

export default KpiTiles;
