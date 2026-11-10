import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button, Tooltip } from '@nextui-org/react';
import { LuCheck, LuPartyPopper, LuTicket, LuX } from 'react-icons/lu';
import { updateBooking } from '@/services/bookings';
import { avatarUrl } from '@/services/storage';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';

// Upcoming booking requests with one-click approve / reject (same updates as the Bookings page).
const PendingBookings = ({ pending, onDecided }) => {
    const toast = useToast();
    const { t, formatDate } = useI18n();
    const [busyId, setBusyId] = useState(null);
    const total = pending.data?.total;

    const decide = async (booking, status) => {
        setBusyId(booking.id);
        try {
            await updateBooking(booking.id, { status });
            toast.success(t('Booking #{id} {status}.', { id: booking.id, status: t(status) }));
            onDecided();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <SectionCard
            className="pendingCard"
            icon={LuTicket}
            title={t('Booking requests')}
            subtitle={
                total === undefined ? t('Checking for new requests…') : total ? t('{count} waiting for approval', { count: total }) : t('You’re all caught up')
            }
            footer={
                <CardFooterLink to={total ? '/admin/bookings?status=pending' : '/admin/bookings'}>
                    {total > (pending.data?.rows.length ?? 0) ? t('Review all {count} requests', { count: total }) : t('Go to all bookings')}
                </CardFooterLink>
            }
        >
            <AsyncState
                state={pending}
                isEmpty={pending.data?.rows.length === 0}
                emptyText={
                    <span className="emptyState">
                        <LuPartyPopper aria-hidden="true" /> {t('No upcoming requests to review.')}
                    </span>
                }
            >
                {({ rows }) => (
                    <ul className="requestList">
                        <AnimatePresence initial={false}>
                            {rows.map((booking) => {
                                const guest = booking.guest?.full_name || booking.guest?.username || t('Guest');
                                const busy = busyId === booking.id;
                                return (
                                    <motion.li
                                        key={booking.id}
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: 32 }}
                                        transition={{ duration: 0.25 }}
                                        className="requestItem"
                                    >
                                        <Avatar
                                            {...AVATAR_DEFAULTS}
                                            size="sm"
                                            src={avatarUrl(booking.guest?.avatar_path, booking.guest?.updated_at) ?? undefined}
                                            name={guest}
                                        />
                                        <div className="requestInfo">
                                            <span className="requestHead">
                                                <strong>{guest}</strong>
                                                <span className="requestAmount">{formatVnd(booking.full_payment)}</span>
                                            </span>
                                            <span className="requestWhen">
                                                {booking.room?.name} · {formatDate(booking.date, 'short')} ·{' '}
                                                {formatTimeRange(booking.start_time, booking.end_time)}
                                            </span>
                                        </div>
                                        <div className="requestActions">
                                            <Tooltip content={t('Reject')} color="danger">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="flat"
                                                    color="danger"
                                                    aria-label={t('Reject booking {id}', { id: booking.id })}
                                                    isDisabled={busy}
                                                    onPress={() => decide(booking, 'rejected')}
                                                >
                                                    <LuX />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content={t('Approve')} color="success">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    color="success"
                                                    className="text-white"
                                                    aria-label={t('Approve booking {id}', { id: booking.id })}
                                                    isLoading={busy}
                                                    onPress={() => decide(booking, 'approved')}
                                                >
                                                    <LuCheck />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </motion.li>
                                );
                            })}
                        </AnimatePresence>
                    </ul>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default PendingBookings;
