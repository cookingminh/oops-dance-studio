import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button, Tooltip } from '@nextui-org/react';
import { LuCheck, LuPartyPopper, LuTicket, LuX } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { updateBooking } from '@/services/bookings';
import { avatarUrl } from '@/services/storage';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';

// Upcoming booking requests with one-click approve / reject (same updates as the Bookings page).
const PendingBookings = ({ pending, onDecided }) => {
    const toast = useToast();
    const [busyId, setBusyId] = useState(null);
    const total = pending.data?.total;

    const decide = async (booking, status) => {
        setBusyId(booking.id);
        try {
            await updateBooking(booking.id, { status });
            toast.success(`Booking #${booking.id} ${status}.`);
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
            title="Booking requests"
            subtitle={total === undefined ? 'Checking for new requests…' : total ? `${total} waiting for approval` : 'You’re all caught up'}
            footer={
                <CardFooterLink to="/admin/bookings">
                    {total > (pending.data?.rows.length ?? 0) ? `Review all ${total} requests` : 'Go to all bookings'}
                </CardFooterLink>
            }
        >
            <AsyncState
                state={pending}
                isEmpty={pending.data?.rows.length === 0}
                emptyText={
                    <span className="emptyState">
                        <LuPartyPopper aria-hidden="true" /> No upcoming requests to review.
                    </span>
                }
            >
                {({ rows }) => (
                    <ul className="requestList">
                        <AnimatePresence initial={false}>
                            {rows.map((booking) => {
                                const guest = booking.guest?.full_name || booking.guest?.username || 'Guest';
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
                                                {booking.room?.name} · {format(parseISO(booking.date), 'EEE d MMM')} ·{' '}
                                                {formatTimeRange(booking.start_time, booking.end_time)}
                                            </span>
                                        </div>
                                        <div className="requestActions">
                                            <Tooltip content="Reject" color="danger">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="flat"
                                                    color="danger"
                                                    aria-label={`Reject booking ${booking.id}`}
                                                    isDisabled={busy}
                                                    onPress={() => decide(booking, 'rejected')}
                                                >
                                                    <LuX />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="Approve" color="success">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    color="success"
                                                    className="text-white"
                                                    aria-label={`Approve booking ${booking.id}`}
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
