import { useState } from 'react';
import { Modal, Input, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem, Textarea } from '@nextui-org/react';
import { BOOKING_STATUSES, staffCreateBooking, updateBooking } from '@/services/bookings';
import { TIME_OPTIONS, formatTime, formatVnd, toMinutes } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import PersonAutocomplete from '@/ui/PersonAutocomplete';
import { listPriceFor } from '../../bookingsModel';
import NewBookingMoney from './NewBookingMoney';

// `draft` prefills a new booking (a free slot picked on the calendar): { roomId, date, startTime, endTime }.
const initialForm = (booking, draft) => ({
    guestId: booking?.guest_id ?? null,
    roomId: booking ? String(booking.room_id) : draft?.roomId ? String(draft.roomId) : '',
    date: booking?.date ?? draft?.date ?? '',
    startTime: booking ? formatTime(booking.start_time) : draft?.startTime ?? '',
    endTime: booking ? formatTime(booking.end_time) : draft?.endTime ?? '',
    status: booking?.status ?? 'approved',
    details: booking?.details ?? '',
});

const NO_MONEY = { changing: false, price: '', priceNote: '', status: 'approved', paidKind: 'none', other: '', method: 'cash', paymentNote: '' };

// Staff create (for a guest) or edit a booking. `booking` = null means create (prefilled from `draft`).
// Create: the server prices it from the room (or another agreed price with its reason), sets its payment
// code and records money taken now, all in one go (staffCreateBooking); onSaved(created, { taken }).
// Edit: guest, room, date, times, status and details only — money changes through the booking dialog's
// Record payment / Change price, so every amount has a line in its history; onSaved(updated).
const BookingForm = ({ booking, draft, rooms, guests, onClose, onSaved }) => {
    const toast = useToast();
    const { t } = useI18n();
    const [form, setForm] = useState(() => initialForm(booking, draft));
    const [money, setMoney] = useState(NO_MONEY);
    const [saving, setSaving] = useState(false);
    const isNew = !booking;

    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
    const timeError = form.startTime && form.endTime && toMinutes(form.startTime) >= toMinutes(form.endTime)
        ? t('End time must be after start time.')
        : '';
    const room = rooms.find((item) => String(item.id) === form.roomId);
    const hours = form.startTime && form.endTime && !timeError ? (toMinutes(form.endTime) - toMinutes(form.startTime)) / 60 : null;
    const list = timeError ? null : listPriceFor(room, form.startTime, form.endTime);

    // New booking: the agreed total, and what is taken now.
    const total = money.changing && money.price !== '' ? Number(money.price) : list;
    const priceChanged = money.changing && total !== null && total !== list;
    const taken = { none: 0, deposit: total === null ? 0 : Math.round(total * 0.5), full: total ?? 0, other: Number(money.other) || 0 }[money.paidKind];
    const moneyError = !isNew
        ? ''
        : money.changing && (money.price === '' || !Number.isInteger(Number(money.price)) || Number(money.price) < 0)
            ? t('Enter the new total in VND.')
            : priceChanged && !money.priceNote.trim()
                ? t('Say why the price changes.')
                : money.paidKind === 'other' && (!Number.isInteger(Number(money.other)) || Number(money.other) <= 0)
                    ? t('Enter an amount in VND.')
                    : '';
    const canSave = (!isNew || form.guestId) && form.roomId && form.date && form.startTime && form.endTime && !timeError && !moneyError;

    // Edit: what happens to the price when the room or the times move (the server recomputes the list
    // price; the agreed price follows it unless staff changed it by hand).
    const moved = !isNew && (form.roomId !== String(booking.room_id) || form.startTime !== formatTime(booking.start_time) || form.endTime !== formatTime(booking.end_time));
    const byHand = !isNew && booking.list_price !== null && booking.list_price !== undefined && Number(booking.full_payment) !== Number(booking.list_price);

    const handleSubmit = async () => {
        setSaving(true);
        try {
            if (isNew) {
                const created = await staffCreateBooking({
                    guestId: form.guestId,
                    roomId: Number(form.roomId),
                    date: form.date,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    details: form.details,
                    status: money.status,
                    price: priceChanged ? total : null,
                    priceNote: priceChanged ? money.priceNote.trim() : null,
                    paid: taken,
                    method: money.method,
                    paymentNote: taken ? money.paymentNote.trim() || null : null,
                });
                toast.success(t('Booking #{id} created · code {code}', { id: created.id, code: created.payment_code }));
                onSaved(created, { taken });
            } else {
                const fields = { ...form, roomId: Number(form.roomId) };
                delete fields.guestId; // the guest of an existing booking doesn't change
                const updated = await updateBooking(booking.id, fields);
                toast.success('Booking updated.');
                onSaved(updated);
            }
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const submitLabel = !isNew
        ? t('Update Booking')
        : taken > 0
            ? t('Add Booking · {amount} taken in {method}', { amount: formatVnd(taken), method: money.method === 'cash' ? t('cash') : t('transfer') })
            : t('Add Booking');

    return (
        <Modal isOpen size="2xl" scrollBehavior="inside" onOpenChange={(open) => !open && onClose()} classNames={{ base: 'bookingForm adminPortal' }}>
            <ModalContent>
                <ModalHeader>{isNew ? t('Add Booking') : t('Edit Booking #{id}', { id: booking.id })}</ModalHeader>
                <ModalBody>
                    {isNew ? (
                        <PersonAutocomplete label={t('Guest')} people={guests} value={form.guestId} onChange={set('guestId')} isRequired />
                    ) : (
                        <p className="text-sm">
                            {t('Guest:')} <strong>{booking.guest?.full_name || booking.guest?.username || booking.guest?.email}</strong>
                        </p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Select
                            label={t('Room')}
                            isRequired
                            selectedKeys={form.roomId ? [form.roomId] : []}
                            onChange={(event) => set('roomId')(event.target.value)}
                        >
                            {rooms.map((item) => (
                                <SelectItem key={String(item.id)}>{item.name}</SelectItem>
                            ))}
                        </Select>
                        <Input label={t('Date')} type="date" isRequired value={form.date} onValueChange={set('date')} />
                        <Select
                            label={t('Start')}
                            isRequired
                            selectedKeys={form.startTime ? [form.startTime] : []}
                            onChange={(event) => set('startTime')(event.target.value)}
                        >
                            {TIME_OPTIONS.slice(0, -1).map((time) => (
                                <SelectItem key={time}>{time}</SelectItem>
                            ))}
                        </Select>
                        <Select
                            label={t('End')}
                            isRequired
                            selectedKeys={form.endTime ? [form.endTime] : []}
                            onChange={(event) => set('endTime')(event.target.value)}
                            isInvalid={Boolean(timeError)}
                            errorMessage={timeError || undefined}
                        >
                            {TIME_OPTIONS.slice(1).map((time) => (
                                <SelectItem key={time}>{time}</SelectItem>
                            ))}
                        </Select>
                        {!isNew && (
                            <Select
                                label={t('Status')}
                                selectedKeys={[form.status]}
                                onChange={(event) => event.target.value && set('status')(event.target.value)}
                            >
                                {BOOKING_STATUSES.map((status) => (
                                    <SelectItem key={status} className="capitalize">{t(status)}</SelectItem>
                                ))}
                            </Select>
                        )}
                    </div>
                    {moved && list !== null && (
                        <p className="bfHint" role="status">
                            {byHand
                                ? t('The agreed price stays {amount} (changed by hand).', { amount: formatVnd(booking.full_payment) })
                                : t('The price follows the new times: {amount}.', { amount: formatVnd(list) })}
                        </p>
                    )}
                    {isNew && <NewBookingMoney room={room} hours={hours} list={list} money={money} set={(patch) => setMoney((prev) => ({ ...prev, ...patch }))} />}
                    <Textarea label={t('Details')} placeholder={t('Optional')} value={form.details} onValueChange={set('details')} />
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving} isDisabled={!canSave}>
                        {submitLabel}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default BookingForm;
