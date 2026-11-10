import { Avatar, Button, Chip, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuCalendarDays, LuMail, LuPencil, LuPhone, LuStickyNote, LuTrash2, LuWallet } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { formatTimeRange, formatVnd, toMinutes } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { statusColorMap } from '../../../../../../../Table/utils';
import { DEPOSIT_LABELS, QUICK_ACTIONS } from '../../useBookingActions';
import { guestName } from '../../bookingsModel';

// Buttons for the status changes a booking allows (same choices as the table's ⋮ menu).
const STATUS_BUTTONS = {
    approved: { color: 'success', className: 'text-white' },
    rejected: { color: 'danger', variant: 'flat' },
    completed: { color: 'primary' },
    cancelled: { color: 'danger', variant: 'flat' },
};

// One booking at a glance (opened from the calendar or the table's #id): guest, room, time, money,
// notes, plus the table's actions. Edits go through BookingForm (onEdit).
const BookingDetails = ({ booking, phone, roomColor, actions, onEdit, onClose }) => {
    const { t, tn, formatDate } = useI18n();
    const { busyId, setStatus, remove } = actions;
    const name = guestName(booking, t);
    const busy = busyId === booking.id;
    const minutes = toMinutes(booking.end_time.slice(0, 5)) - toMinutes(booking.start_time.slice(0, 5));
    const duration = minutes % 60
        ? t('{hours} h {minutes} min', { hours: Math.floor(minutes / 60), minutes: minutes % 60 })
        : tn(minutes / 60, '{count} hour', '{count} hours');
    const received = [
        booking.bank_transfer ? t('Transfer {amount}', { amount: formatVnd(booking.bank_transfer) }) : null,
        booking.cash ? t('Cash {amount}', { amount: formatVnd(booking.cash) }) : null,
    ].filter(Boolean);

    const run = async (work) => {
        if (await work()) onClose();
    };

    return (
        <Modal isOpen size="2xl" placement="center" scrollBehavior="inside" onOpenChange={(open) => !open && onClose()} classNames={{ base: 'bookingDetails adminPortal' }}>
            <ModalContent>
                <ModalHeader className="bdHeader">
                    <span className="bdTitle">{t('Booking #{id}', { id: booking.id })}</span>
                    <Chip className="capitalize" color={statusColorMap[booking.status] ?? 'default'} size="sm" variant="flat">
                        {t(booking.status)}
                    </Chip>
                </ModalHeader>
                <ModalBody className="bdBody">
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
                        <div>
                            <dt>
                                <LuWallet aria-hidden="true" /> {t('Total')}
                            </dt>
                            <dd>
                                <strong>{formatVnd(booking.full_payment)}</strong>
                                <span>
                                    {t('Deposit {amount}', { amount: formatVnd(booking.deposit) })} ·{' '}
                                    <span className={`depositState is-${booking.deposit_status}`}>{t(DEPOSIT_LABELS[booking.deposit_status] ?? booking.deposit_status)}</span>
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt>{t('Received')}</dt>
                            <dd>
                                {booking.real_income === null || booking.real_income === undefined ? (
                                    <span className="bdMuted">{t('Nothing recorded yet')}</span>
                                ) : (
                                    <>
                                        <strong>{formatVnd(booking.real_income)}</strong>
                                        {received.length > 0 && <span>{received.join(' · ')}</span>}
                                    </>
                                )}
                            </dd>
                        </div>
                    </dl>

                    <div className="bdNotes">
                        <LuStickyNote aria-hidden="true" />
                        {booking.details ? <p>{booking.details}</p> : <p className="bdMuted">{t('No notes')}</p>}
                    </div>
                </ModalBody>
                <ModalFooter className="bdFooter">
                    <div className="bdFooterGroup">
                        <Button variant="light" color="danger" startContent={<LuTrash2 aria-hidden="true" />} isDisabled={busy} onPress={() => run(() => remove(booking.id))}>
                            {t('Delete booking')}
                        </Button>
                        <Button variant="flat" startContent={<LuPencil aria-hidden="true" />} isDisabled={busy} onPress={() => onEdit(booking)}>
                            {t('Edit booking & payments')}
                        </Button>
                    </div>
                    {QUICK_ACTIONS[booking.status] && (
                        <div className="bdFooterGroup isDecide">
                            {QUICK_ACTIONS[booking.status]
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
    );
};

export default BookingDetails;
