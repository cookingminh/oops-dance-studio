import { useState } from 'react';
import { Modal, Input, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem, Textarea } from '@nextui-org/react';
import { BOOKING_STATUSES, DEPOSIT_STATUSES, createBookingForGuest, updateBooking } from '@/services/bookings';
import { TIME_OPTIONS, formatTime, toMinutes } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import PersonAutocomplete from '@/ui/PersonAutocomplete';

const MONEY_FIELDS = [
    ['deposit', 'Deposit'],
    ['full_payment', 'Full payment'],
    ['real_income', 'Real income'],
    ['bank_transfer', 'Bank transfer'],
    ['cash', 'Cash'],
];

// `draft` prefills a new booking (a free slot picked on the calendar): { roomId, date, startTime, endTime }.
const initialForm = (booking, draft) => ({
    guestId: booking?.guest_id ?? null,
    roomId: booking ? String(booking.room_id) : draft?.roomId ? String(draft.roomId) : '',
    date: booking?.date ?? draft?.date ?? '',
    startTime: booking ? formatTime(booking.start_time) : draft?.startTime ?? '',
    endTime: booking ? formatTime(booking.end_time) : draft?.endTime ?? '',
    status: booking?.status ?? 'approved',
    depositStatus: booking?.deposit_status ?? 'waiting',
    details: booking?.details ?? '',
    ...Object.fromEntries(MONEY_FIELDS.map(([key]) => [key, booking?.[key] ?? ''])),
});

// Staff create (for a guest) or edit a booking. `booking` = null means create (prefilled from `draft`).
const BookingForm = ({ booking, draft, rooms, guests, onClose, onSaved }) => {
    const toast = useToast();
    const { t } = useI18n();
    const [form, setForm] = useState(() => initialForm(booking, draft));
    const [saving, setSaving] = useState(false);
    const isNew = !booking;

    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
    const timeError = form.startTime && form.endTime && toMinutes(form.startTime) >= toMinutes(form.endTime)
        ? t('End time must be after start time.')
        : '';
    const canSave = (!isNew || form.guestId) && form.roomId && form.date && form.startTime && form.endTime && !timeError;

    const handleSubmit = async () => {
        setSaving(true);
        try {
            const fields = { ...form, roomId: Number(form.roomId) };
            if (isNew) {
                await createBookingForGuest(fields);
                toast.success('Booking added.');
            } else {
                delete fields.guestId; // the guest of an existing booking doesn't change
                await updateBooking(booking.id, fields);
                toast.success('Booking updated.');
            }
            onSaved();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen size="2xl" scrollBehavior="inside" onOpenChange={(open) => !open && onClose()}>
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
                            {rooms.map((room) => (
                                <SelectItem key={String(room.id)}>{room.name}</SelectItem>
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
                        <Select
                            label={t('Status')}
                            selectedKeys={[form.status]}
                            onChange={(event) => event.target.value && set('status')(event.target.value)}
                        >
                            {BOOKING_STATUSES.map((status) => (
                                <SelectItem key={status} className="capitalize">{t(status)}</SelectItem>
                            ))}
                        </Select>
                        <Select
                            label={t('Deposit status')}
                            selectedKeys={[form.depositStatus]}
                            onChange={(event) => event.target.value && set('depositStatus')(event.target.value)}
                        >
                            {DEPOSIT_STATUSES.map((status) => (
                                <SelectItem key={status} className="capitalize">{t(status)}</SelectItem>
                            ))}
                        </Select>
                        {MONEY_FIELDS.map(([key, label]) => (
                            <Input
                                key={key}
                                label={`${t(label)} (VND)`}
                                type="number"
                                min={0}
                                step={1000}
                                value={String(form[key])}
                                onValueChange={set(key)}
                            />
                        ))}
                    </div>
                    <Textarea label={t('Details')} value={form.details} onValueChange={set('details')} />
                </ModalBody>
                <ModalFooter>
                    <Button color="danger" variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="primary" onPress={handleSubmit} isLoading={saving} isDisabled={!canSave}>
                        {isNew ? t('Add Booking') : t('Update Booking')}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default BookingForm;
