import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuArrowDownLeft, LuSearch, LuTicket } from 'react-icons/lu';
import { bookingDue, bookingReceived, findBooking } from '@/services/bookingPayments';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { toAppError } from '@/services/errors';

// The OOPS code somewhere in a transfer's content (spaces and dashes as people type them), or ''.
const codeIn = (content) => String(content ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/OOPS[2-9A-HJ-NP-Z]{6}/)?.[0] ?? '';

// Put an inbox transfer on a room booking: find the booking by its number (#236) or payment code,
// check it (guest, room, time, what is due), then assign. onAssign(booking) → true when done.
const BookingAssignDialog = ({ transfer, busy, onClose, onAssign }) => {
    const { t, formatDate } = useI18n();
    const [term, setTerm] = useState(() => codeIn(transfer.content));
    const [result, setResult] = useState(undefined); // undefined = not searched, null = not found
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);
    const amount = Number(transfer.amount);

    const search = async (event) => {
        event?.preventDefault();
        if (!term.trim()) return;
        setSearching(true);
        setError(null);
        try {
            setResult(await findBooking(term));
        } catch (failure) {
            setError(toAppError(failure).message);
            setResult(undefined);
        } finally {
            setSearching(false);
        }
    };

    const booking = result;
    const closed = booking && ['rejected', 'cancelled'].includes(booking.status);
    const due = booking ? bookingDue(booking) : null;
    const left = booking ? Math.max(Number(booking.full_payment ?? 0) - bookingReceived(booking), 0) : 0;
    const diff = amount - left;
    const fit = diff === 0 ? { text: t('Exact amount'), tone: 'isExact' } : diff < 0 ? { text: t('{amount} short', { amount: formatVnd(-diff) }), tone: 'isShort' } : { text: t('{amount} over', { amount: formatVnd(diff) }), tone: 'isOver' };

    return (
        <Modal isOpen onOpenChange={(open) => !open && onClose()} size="xl" placement="center" scrollBehavior="inside" classNames={{ base: 'tuDialog tuBookingAssign adminPortal' }}>
            <ModalContent>
                <ModalHeader className="tuAssignHead">
                    <span className="tuTransferIcon" aria-hidden="true">
                        <LuArrowDownLeft />
                    </span>
                    <span>
                        <strong>{t('Which booking does {amount} pay?', { amount: formatVnd(amount) })}</strong>
                        <small className="tuMono">{transfer.content}</small>
                    </span>
                </ModalHeader>
                <ModalBody className="tuDialogBody">
                    <form className="tuBookingFind" onSubmit={search} noValidate>
                        <Input
                            autoFocus
                            label={t('Booking number or code')}
                            placeholder={t('#236 or OOPS…')}
                            value={term}
                            onValueChange={(value) => {
                                setTerm(value);
                                setResult(undefined);
                            }}
                            startContent={<LuTicket className="text-default-400" aria-hidden="true" />}
                        />
                        <Button type="submit" variant="flat" startContent={searching ? null : <LuSearch aria-hidden="true" />} isLoading={searching} isDisabled={!term.trim()}>
                            {t('Find')}
                        </Button>
                    </form>
                    {error && <p className="tuFinePrint isError">{t(error)}</p>}
                    {result === null && <p className="tuFinePrint">{t('No booking has that number or code.')}</p>}
                    {booking && (
                        <div className="tuBookingCard" data-booking={booking.id}>
                            <div className="tuBookingTop">
                                <strong>
                                    {t('Booking #{id}', { id: booking.id })} · {booking.guest?.full_name || booking.guest?.username || t('Guest')}
                                </strong>
                                <span className="tuMono">{booking.payment_code}</span>
                            </div>
                            <span>
                                {booking.room?.name} · {formatDate(booking.date, 'short')} {formatTimeRange(booking.start_time, booking.end_time)} · <span className="capitalize">{t(booking.status)}</span>
                            </span>
                            <dl>
                                <div>
                                    <dt>{t('Total')}</dt>
                                    <dd>{formatVnd(booking.full_payment)}</dd>
                                </div>
                                <div>
                                    <dt>{t('Received')}</dt>
                                    <dd>{formatVnd(bookingReceived(booking))}</dd>
                                </div>
                                <div>
                                    <dt>{t('Due now')}</dt>
                                    <dd>{formatVnd(due.amount)}</dd>
                                </div>
                            </dl>
                            {closed ? (
                                <p className="tuFinePrint isError">{t('This booking is {status}: a transfer can’t be put on it.', { status: t(booking.status) })}</p>
                            ) : (
                                <p className={`tuFinePrint ${fit.tone}`}>
                                    {t('Compared with what is left to pay ({amount}):', { amount: formatVnd(left) })} {fit.text}
                                </p>
                            )}
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button color="danger" isDisabled={!booking || closed} isLoading={busy} onPress={() => onAssign(booking)}>
                        {booking ? t('Assign {amount} to booking #{id}', { amount: formatVnd(amount), id: booking.id }) : t('Assign')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default BookingAssignDialog;
