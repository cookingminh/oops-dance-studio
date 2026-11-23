import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from '@nextui-org/react';
import { LuArrowUpRight, LuCalendarX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';

const POPOVER = { popoverContent: 'adminPortal' };
const UNPLACED = 'none';

// Moving a class into a studio room that is booked on some of its days (class_booking_clashes → `days`:
// [{ date, bookings: [{ id, start, end, who, status }], free_rooms: [{ id, name }] }]). The class still moves; each
// of those sessions goes to another free room that day, or stays without a room for now: staff see it on their
// to-do list until they place it. Each booking can be opened. onConfirm(places) with places [{ date, room_id | null }].
const RoomClashDialog = ({ cls, room, days, onClose, onConfirm }) => {
    const { t, tn, formatDate } = useI18n();
    const [choice, setChoice] = useState(() => Object.fromEntries(days.map((day) => [day.date, day.free_rooms[0] ? String(day.free_rooms[0].id) : UNPLACED])));
    const [saving, setSaving] = useState(false);
    const unplaced = days.filter((day) => choice[day.date] === UNPLACED).length;

    const confirm = async () => {
        setSaving(true);
        try {
            await onConfirm(days.map((day) => ({ date: day.date, room_id: choice[day.date] === UNPLACED ? null : Number(choice[day.date]) })));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen size="2xl" scrollBehavior="inside" onOpenChange={(open) => !open && !saving && onClose()} classNames={{ base: 'adminPortal roomClashDialog' }}>
            <ModalContent>
                <ModalHeader className="flex-col items-start gap-1">
                    {tn(days.length, '{room} is booked on {count} of {name}’s sessions', '{room} is booked on {count} of {name}’s sessions', { room: room?.name ?? '', name: cls.name })}
                    <span className="rcIntro">
                        {t('The class still moves to {room}. Pick where each of these sessions goes that day, or leave it without a room for now: it stays on the to-do list until someone places it.', { room: room?.name ?? '' })}
                    </span>
                </ModalHeader>
                <ModalBody>
                    <ul className="rcDays">
                        {days.map((day) => (
                            <li key={day.date} className="rcDay">
                                <div className="rcWhen">
                                    <strong>{formatDate(day.date, 'full')}</strong>
                                    {day.bookings.map((booking) => (
                                        <span key={booking.id} className="rcBooking">
                                            {t('Booking #{id}', { id: booking.id })} · {booking.who} · {booking.start}–{booking.end} · {t(booking.status)}
                                            <Link to={`/admin/bookings?booking=${booking.id}`} className="rcOpen">
                                                {t('Open booking')} <LuArrowUpRight aria-hidden="true" />
                                            </Link>
                                        </span>
                                    ))}
                                </div>
                                <Select
                                    label={t('This session takes place in')}
                                    size="sm"
                                    classNames={POPOVER}
                                    selectedKeys={[choice[day.date]]}
                                    onChange={(event) => event.target.value && setChoice((old) => ({ ...old, [day.date]: event.target.value }))}
                                    className="rcPick"
                                >
                                    {[
                                        ...day.free_rooms.map((free) => <SelectItem key={String(free.id)}>{free.name}</SelectItem>),
                                        <SelectItem key={UNPLACED} startContent={<LuCalendarX aria-hidden="true" />}>
                                            {t('No room yet (to-do for staff)')}
                                        </SelectItem>,
                                    ]}
                                </Select>
                            </li>
                        ))}
                    </ul>
                    {unplaced > 0 && (
                        <p className="rcNote" role="status">
                            {tn(unplaced, '{count} session will have no room yet: it goes on the to-do list.', '{count} sessions will have no room yet: they go on the to-do list.')}
                        </p>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={saving}>
                        {t('Close')}
                    </Button>
                    <Button color="danger" onPress={confirm} isLoading={saving}>
                        {t('Move the class to {room}', { room: room?.name ?? '' })}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default RoomClashDialog;
