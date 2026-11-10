import { useState } from 'react';
import { cancelBooking, deleteBooking, updateBooking } from '@/services/bookings';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { useStaffTasks } from '../../../tasks/staffTasks';

// Quick status changes per status (the table's ⋮ menu and the booking dialog).
export const QUICK_ACTIONS = {
    pending: [['approved', 'Approve'], ['rejected', 'Reject']],
    approved: [['completed', 'Mark completed'], ['cancelled', 'Cancel']],
};

export const DEPOSIT_LABELS = { waiting: 'waiting', completed: 'paid', cancelled: 'cancelled' };

// Status changes and deletes shared by the list and the calendar. `onChanged` reloads the bookings.
// Each returns true when it worked (so a dialog can close).
export function useBookingActions(onChanged) {
    const toast = useToast();
    const { t } = useI18n();
    const { refresh: refreshTasks } = useStaffTasks();
    const [busyId, setBusyId] = useState(null);

    const setStatus = async (id, status) => {
        setBusyId(id);
        try {
            if (status === 'cancelled') await cancelBooking(id);
            else await updateBooking(id, { status });
            toast.success(t('Booking #{id} is now {status}.', { id, status: t(status) }));
            onChanged();
            refreshTasks();
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

    return { busyId, setStatus, remove };
}
