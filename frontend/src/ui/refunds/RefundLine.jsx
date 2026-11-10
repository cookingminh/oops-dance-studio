import { LuCheck, LuUndo2 } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { refundOf } from './refundText';
import './refunds.scss';

// A cancelled booking's refund, for the guest (My bookings row or card): what the studio still has to
// give back (and where to), and what it already gave back. Nothing when no money goes back.
const RefundLine = ({ booking }) => {
    const { t } = useI18n();
    const { due, paid } = refundOf(booking);
    if (!due && !paid) return null;
    return (
        <>
            {due > 0 && (
                <span className="rfLine isDue">
                    <LuUndo2 aria-hidden="true" />
                    <span>
                        {booking.refund_to
                            ? t('The studio will refund {amount} to {account}', { amount: formatVnd(due), account: booking.refund_to })
                            : t('The studio will refund {amount}', { amount: formatVnd(due) })}
                    </span>
                </span>
            )}
            {paid > 0 && (
                <span className="rfLine isPaid">
                    <LuCheck aria-hidden="true" />
                    <span>{t('Refunded {amount}', { amount: formatVnd(paid) })}</span>
                </span>
            )}
        </>
    );
};

export default RefundLine;
