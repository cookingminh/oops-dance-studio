import { useEffect, useState } from 'react';
import { Avatar, Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuCalendarDays, LuMail, LuPencil, LuPhone, LuStickyNote, LuTrash2 } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { formatTimeRange, toMinutes } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import BookingPayDialog from '@/ui/payment/BookingPayDialog';
import BookingReceipt from '@/ui/payment/BookingReceipt';
import { statusColorMap } from '../../../../../../../Table/utils';
import { guestName, isPaidAhead } from '../../bookingsModel';
import BookingPayment from './BookingPayment';

// Buttons for the status changes a booking allows (same choices as the table's ⋮ menu).
const STATUS_BUTTONS = {
    approved: { color: 'success', className: 'text-white' },
    rejected: { color: 'danger', variant: 'flat' },
    completed: { color: 'primary' },
    cancelled: { color: 'danger', variant: 'flat' },
};

// One booking at a glance (opened from the calendar or the table's #id): guest, room, time and notes
// on the left, the payment (summary, QR, receipt, history) on the right, plus the table's actions.
// Edits go through BookingForm (onEdit); onRefresh reloads the bookings after a payment.
const BookingDetails = ({ booking, phone, roomColor, actions, settings, sandbox, today, initialExtra = null, onEdit, onClose, onRefresh }) => {
    const { t, tn, formatDate } = useI18n();
    const [extra, setExtra] = useState(null); // { kind: 'pay', choice? } | { kind: 'receipt' }
    // Opening straight on the QR (a new booking): only once this dialog is up. Two modals mounting together
    // hide each other from screen readers (each marks the rest of the page aria-hidden).
    useEffect(() => {
        if (!initialExtra) return undefined;
        const timer = setTimeout(() => setExtra({ kind: initialExtra }), 300);
        return () => clearTimeout(timer);
    }, [initialExtra]);
    const { busyId, setStatus, remove, quick } = actions;
    const decisions = quick(booking);
    const name = guestName(booking, t);
    const busy = busyId === booking.id;
    const minutes = toMinutes(booking.end_time.slice(0, 5)) - toMinutes(booking.start_time.slice(0, 5));
    const duration = minutes % 60 ? t('{hours} h {minutes} min', { hours: Math.floor(minutes / 60), minutes: minutes % 60 }) : tn(minutes / 60, '{count} hour', '{count} hours');

    const run = async (work) => {
        if (await work()) onClose();
    };

    return (
        <>
            <Modal isOpen size="4xl" placement="center" scrollBehavior="inside" onOpenChange={(open) => !open && onClose()} classNames={{ base: 'bookingDetails adminPortal' }}>
                <ModalContent>
                    <ModalHeader className="bdHeader">
                        <span className="bdTitle">{t('Booking #{id}', { id: booking.id })}</span>
                        <Chip className="capitalize" color={statusColorMap[booking.status] ?? 'default'} size="sm" variant="flat">
                            {t(booking.status)}
                        </Chip>
                        {isPaidAhead(booking, today) && <span className="bkPaidUp">{t('Paid up')}</span>}
                        <span className="bdCode" title={t('Payment code')}>
                            {booking.payment_code}
                        </span>
                    </ModalHeader>
                    <ModalBody className="bdBody">
                        <div className="bdColumns">
                            <div className="bdInfo">
                                <div className="bdGuest">
                                    <Avatar
                                        {...AVATAR_DEFAULTS}
                                        size="lg"
                                        radius="full"
                                        name={name}
                                        src={avatarUrl(booking.guest?.avatar_path, booking.guest?.updated_at) ?? undefined}
                                    />
                                    <div className="bdGuestText">
                                        <strong>{name}</strong>
                                        {phone ? (
                                            <a href={`tel:${phone.replace(/\s+/g, '')}`}>
                                                <LuPhone aria-hidden="true" /> {phone}
                                            </a>
                                        ) : (
                                            <span className="bdMuted">
                                                <LuPhone aria-hidden="true" /> {t('No phone number')}
                                            </span>
                                        )}
                                        {booking.guest?.email && (
                                            <a href={`mailto:${booking.guest.email}`}>
                                                <LuMail aria-hidden="true" /> {booking.guest.email}
                                            </a>
                                        )}
                                    </div>
                                </div>

                                <dl className="bdFacts">
                                    <div>
                                        <dt>{t('Room')}</dt>
                                        <dd>
                                            <span className="roomPill">
                                                <span className="segDot" style={{ background: roomColor.get(booking.room_id) }} aria-hidden="true" />
                                                {booking.room?.name}
                                            </span>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            <LuCalendarDays aria-hidden="true" /> {t('When')}
                                        </dt>
                                        <dd>
                                            <strong className="bdDate">{formatDate(booking.date, 'full')}</strong>
                                            <span>
                                                {formatTimeRange(booking.start_time, booking.end_time)} · {duration}
                                            </span>
                                        </dd>
                                    </div>
                                </dl>

                                <div className="bdNotes">
                                    <LuStickyNote aria-hidden="true" />
                                    {booking.details ? <p>{booking.details}</p> : <p className="bdMuted">{t('No notes')}</p>}
                                </div>
                            </div>
                            <BookingPayment booking={booking} onPay={(choice) => setExtra({ kind: 'pay', choice })} onReceipt={() => setExtra({ kind: 'receipt' })} onChanged={onRefresh} />
                        </div>
                    </ModalBody>
                    <ModalFooter className="bdFooter">
                        <div className="bdFooterGroup">
                            <Button variant="light" color="danger" startContent={<LuTrash2 aria-hidden="true" />} isDisabled={busy} onPress={() => run(() => remove(booking.id))}>
                                {t('Delete booking')}
                            </Button>
                            <Button variant="flat" startContent={<LuPencil aria-hidden="true" />} isDisabled={busy} onPress={() => onEdit(booking)}>
                                {t('Edit booking')}
                            </Button>
                        </div>
                        {decisions.length > 0 && (
                            <div className="bdFooterGroup isDecide">
                                {decisions
                                    .slice()
                                    .reverse()
                                    .map(([status, label]) => (
                                        <Button key={status} {...STATUS_BUTTONS[status]} isLoading={busy} onPress={() => run(() => setStatus(booking.id, status))}>
                                            {/* "Cancel" alone would read like closing the dialog. */}
                                            {t(status === 'cancelled' ? 'Cancel booking' : label)}
                                        </Button>
                                    ))}
                            </div>
                        )}
                    </ModalFooter>
                </ModalContent>
            </Modal>
            {extra?.kind === 'pay' && <BookingPayDialog booking={booking} initialChoice={extra.choice} settings={settings} sandbox={sandbox} onClose={() => setExtra(null)} onChanged={onRefresh} />}
            {extra?.kind === 'receipt' && <BookingReceipt booking={booking} guest={{ name, phone, email: booking.guest?.email }} today={today} onClose={() => setExtra(null)} />}
        </>
    );
};

export default BookingDetails;
