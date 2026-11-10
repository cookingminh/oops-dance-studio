import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuBanknote, LuCalendarX, LuCheck, LuLandmark, LuUndo2 } from 'react-icons/lu';
import { refundBooking } from '@/services/bookingRefunds';
import { bookingReceived } from '@/services/bookingPayments';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { refundOf } from '@/ui/refunds/refundText';
import { useStaffTasks } from '../../../../../tasks/staffTasks';
import { guestName } from '../../bookingsModel';
import RefundAmountDialog from './RefundAmountDialog';
import { cancelledBy, studioDay } from './refundModel';
import './refunds.scss';

// A cancelled or rejected booking in the booking dialog: who cancelled and when; what is still to give back
// (where to, why) with "Refunded by transfer / in cash" (booking_refund); what was given back; what the
// studio keeps; and "Change the refund" (booking_set_refund, with a reason). onChanged reloads the booking.
const RefundBlock = ({ booking, onChanged }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const { refresh: refreshTasks } = useStaffTasks();
    const [busy, setBusy] = useState(null); // 'transfer' | 'cash'
    const [editing, setEditing] = useState(false);
    const { due, paid } = refundOf(booking);
    const received = bookingReceived(booking);
    const keep = Math.max(received - due, 0);
    const name = guestName(booking, t);
    const day = (timestamp) => (timestamp ? formatDate(studioDay(timestamp), 'short') : '');

    const refund = async (method) => {
        const question =
            method === 'cash'
                ? t('Record that {amount} went back to {name} in cash?', { amount: formatVnd(due), name })
                : t('Record that {amount} went back to {name} by transfer?', { amount: formatVnd(due), name });
        if (!window.confirm(question)) return;
        setBusy(method);
        try {
            await refundBooking(booking.id, { method });
            toast.success('Refund recorded.');
            onChanged();
            refreshTasks();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const changed = () => {
        onChanged();
        refreshTasks();
    };

    return (
        <div className={`bdDueHero rbBlock ${due > 0 ? 'isDue' : 'isClosed'}`}>
            <p className="rbHead">
                <LuCalendarX aria-hidden="true" />
                <span>
                    <strong>{t('The booking is {status}', { status: t(booking.status) })}</strong>
                    {booking.cancelled_at && <small>{[t(cancelledBy(booking)), day(booking.cancelled_at)].join(' · ')}</small>}
                </span>
            </p>

            {due > 0 && (
                <div className="rbDue">
                    <span className="bdDueLabel">{t('To refund')}</span>
                    <strong className="bdDueAmount">{formatVnd(due)}</strong>
                    <p className={`rbTo${booking.refund_to ? '' : ' isMissing'}`}>
                        {booking.refund_to ? t('Send to: {account}', { account: booking.refund_to }) : t('No account given: contact the guest.')}
                    </p>
                    {booking.refund_note && <p className="rbNote">“{booking.refund_note}”</p>}
                    <div className="bdQuickPay">
                        <Button size="sm" color="danger" startContent={<LuLandmark aria-hidden="true" />} isLoading={busy === 'transfer'} isDisabled={Boolean(busy)} onPress={() => refund('transfer')}>
                            {t('Refunded by transfer')}
                        </Button>
                        <Button size="sm" color="danger" variant="flat" startContent={<LuBanknote aria-hidden="true" />} isLoading={busy === 'cash'} isDisabled={Boolean(busy)} onPress={() => refund('cash')}>
                            {t('Refunded in cash')}
                        </Button>
                    </div>
                </div>
            )}

            {(paid > 0 || keep > 0 || (due === 0 && booking.refund_note)) && (
                <ul className="rbFacts">
                    {paid > 0 && (
                        <li className="isPaid">
                            <LuCheck aria-hidden="true" />
                            <span>{[t('Refunded {amount}', { amount: formatVnd(paid) }), day(booking.refunded_at)].filter(Boolean).join(' · ')}</span>
                        </li>
                    )}
                    {keep > 0 && (
                        <li>
                            <LuBanknote aria-hidden="true" />
                            <span>{t('Studio keeps {amount}', { amount: formatVnd(keep) })}</span>
                        </li>
                    )}
                    {due === 0 && booking.refund_note && <li className="rbNote">“{booking.refund_note}”</li>}
                </ul>
            )}

            {received > 0 && (
                <button type="button" className="bdLink rbChange" onClick={() => setEditing(true)}>
                    <LuUndo2 aria-hidden="true" /> {t('Change the refund')}
                </button>
            )}
            {editing && <RefundAmountDialog booking={booking} onClose={() => setEditing(false)} onDone={changed} />}
        </div>
    );
};

export default RefundBlock;
