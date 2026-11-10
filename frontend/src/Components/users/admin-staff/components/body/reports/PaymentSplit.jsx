import { motion } from 'framer-motion';
import { LuLandmark } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';
import { COLORS } from './reportChart';
import { LegendKeys } from './ChartBits';

// Tuition received by bank transfer vs cash, one thin bar per month (newest first). Transfers
// update invoices by themselves; cash needs staff to record it, so a growing blue share is good.
const PaymentSplit = ({ rows, focusMonth, onPick, fmt }) => {
    const { t } = useI18n();
    const paid = rows.filter((row) => row.transfer_amount + row.cash_amount > 0).reverse();
    const focused = rows.find((row) => row.month === focusMonth);

    return (
        <SectionCard
            className="paymentCard"
            icon={LuLandmark}
            title={t('How students pay')}
            subtitle={
                focused?.transferShare !== null && focused?.transferShare !== undefined
                    ? t('{pct} of tuition by bank transfer in {month}', { pct: fmt.pct(focused.transferShare), month: fmt.monthName(focusMonth) })
                    : t('Tuition by bank transfer and in cash')
            }
        >
            <LegendKeys keys={[{ label: t('Bank transfer'), color: COLORS.transfer }, { label: t('Cash'), color: COLORS.cash }]} />
            {paid.length === 0 ? (
                <p className="insightEmpty">{t('No tuition received yet.')}</p>
            ) : (
                <>
                <div className="splitHead" aria-hidden="true">
                    <span>{t('Month')}</span>
                    <span />
                    <span>{t('By transfer')}</span>
                    <span>{t('Received')}</span>
                </div>
                <motion.ul className="splitList" variants={stagger} initial="hidden" animate="show">
                    {paid.map((row) => {
                        const total = row.transfer_amount + row.cash_amount;
                        const share = row.transfer_amount / total;
                        const label = t('{month}: {transfer} by transfer, {cash} in cash', {
                            month: fmt.monthName(row.month),
                            transfer: fmt.money(row.transfer_amount),
                            cash: fmt.money(row.cash_amount),
                        });
                        return (
                            <motion.li variants={fadeUp} key={row.month}>
                                <button
                                    type="button"
                                    className={`splitRow${row.month === focusMonth ? ' isFocused' : ''}`}
                                    aria-pressed={row.month === focusMonth}
                                    aria-label={label}
                                    title={label}
                                    onClick={() => onPick(row.month)}
                                >
                                    <span className="splitMonth">
                                        {fmt.shortMonth(row.month)}
                                        {row.inProgress && <small>{t('so far')}</small>}
                                    </span>
                                    <span className="splitBar" aria-hidden="true">
                                        {row.transfer_amount > 0 && <span style={{ width: `${share * 100}%`, background: COLORS.transfer }} />}
                                        {row.cash_amount > 0 && <span style={{ width: `${(1 - share) * 100}%`, background: COLORS.cash }} />}
                                    </span>
                                    <span className="splitShare">{fmt.pct(share)}</span>
                                    <span className="splitTotal">{fmt.short(total)}</span>
                                </button>
                            </motion.li>
                        );
                    })}
                </motion.ul>
                </>
            )}
        </SectionCard>
    );
};

export default PaymentSplit;
