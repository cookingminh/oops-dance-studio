import { useState } from 'react';
import { cancelBooking, deleteBooking, updateBooking } from '@/services/bookings';
import { studioTimeNow } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { useStaffTasks } from '../../../tasks/staffTasks';
import { bookingStarted } from './bookingsModel';

// Quick status changes a booking allows now (the table's ⋮ menu and the booking dialog), as
// [status, English label] pairs. A booking paid in full is `completed` by itself, so "Mark completed" is
// for one that already happened (staff confirm it took place); a completed one that hasn't started can
// still be cancelled (cancel_booking), one that started can't.
export function quickActionsOf(booking, today, now = studioTimeNow()) {
    const started = bookingStarted(booking, today, now);
    switch (booking.status) {
        case 'pending':
            return [['approved', 'Approve'], ['rejected', 'Reject']];
        case 'approved':
            return started ? [['completed', 'Mark completed'], ['cancelled', 'Cancel']] : [['cancelled', 'Cancel']];
        case 'completed':
            return started ? [] : [['cancelled', 'Cancel']];
        default:
            return [];
    }
}

export const DEPOSIT_LABELS = { waiting: 'waiting', completed: 'paid', cancelled: 'cancelled' };

// Status changes and deletes shared by the list and the calendar. `onChanged` reloads the bookings; `today`
// (studio date) decides which quick actions a booking offers (`quick(booking)`).
// Each returns true when it worked (so a dialog can close). Cancelling doesn't happen at once: it opens the
// cancel dialog (`cancelling` = that booking's id), which asks who cancels and how much goes back, then
// calls confirmCancel. Rejecting stays a plain status change (the database makes all the money due back).
export function useBookingActions(onChanged, today) {
    const toast = useToast();
    const { t } = useI18n();
    const { refresh: refreshTasks } = useStaffTasks();
    const [busyId, setBusyId] = useState(null);
    const [cancelling, setCancelling] = useState(null);

    const done = (id, status) => {
        toast.success(t('Booking #{id} is now {status}.', { id, status: t(status) }));
        onChanged();
        refreshTasks();
    };

    const setStatus = async (id, status) => {
        if (status === 'cancelled') {
            setCancelling(id);
            return false;
        }
        setBusyId(id);
        try {
            await updateBooking(id, { status });
            done(id, status);
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        } finally {
            setBusyId(null);
        }
    };

    // { byStudio, refund (null = the policy's amount), note } → cancel_booking.
    const confirmCancel = async (id, choice) => {
        setBusyId(id);
        try {
            await cancelBooking(id, choice);
            done(id, 'cancelled');
            setCancelling(null);
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (id) => {
        if (!window.confirm(t('Delete booking #{id}? This can’t be undone.', { id }))) return false;
        try {
            await deleteBooking(id);
            toast.success('Booking deleted.');
            onChanged();
            refreshTasks();
            return true;
        } catch (error) {
            toast.error(error);
            return false;
        }
    };

    const quick = (booking) => quickActionsOf(booking, today);

    return { busyId, setStatus, remove, quick, cancelling, confirmCancel, closeCancel: () => setCancelling(null) };
}
