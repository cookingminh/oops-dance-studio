import { useMemo, useState } from 'react';
import { Modal, Input, Button, ModalHeader, ModalBody, ModalFooter, ModalContent, Select, SelectItem, Switch, Textarea } from '@nextui-org/react';
import { LuCalendarPlus, LuDoorOpen, LuPencil, LuRepeat, LuStickyNote, LuUser, LuWallet } from 'react-icons/lu';
import { BOOKING_STATUSES, staffCreateBooking, updateBooking } from '@/services/bookings';
import { createSeries } from '@/services/bookingSeries';
import { listRoomSessions } from '@/services/bookingsExtra';
import { useAsync } from '@/hooks/useAsync';
import { TIME_OPTIONS, formatTime, formatVnd, toMinutes } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import PersonAutocomplete from '@/ui/PersonAutocomplete';
import Segmented from '../../../../common/Segmented';
import { studioTodayIso, timeOf } from '../../../../common/calendar/calendarModel';
import { PHONE_PATTERN, byRoomId, isWalkIn, listPriceFor, slotClashes } from '../../bookingsModel';
import NewBookingMoney from './NewBookingMoney';
import RepeatFields from './RepeatFields';
import SeriesDays from './SeriesDays';
import DayPreview from './DayPreview';
import { SeriesCheck, SingleCheck } from './PreviewChecks';
import { plusDays, useSeriesPlan } from './seriesPlan';
import './bookingForm.scss';

// `draft` prefills a new booking (a free slot picked on the calendar): { roomId, date, startTime, endTime }.
const initialForm = (booking, draft, today) => ({
    who: booking && isWalkIn(booking) ? 'walkin' : 'account', // an account, or a walk-in with no account
    guestId: booking?.guest_id ?? null,
    walkInName: booking?.walk_in_name ?? '',
    walkInPhone: booking?.walk_in_phone ?? '',
    roomId: booking ? String(booking.room_id) : draft?.roomId ? String(draft.roomId) : '',
    date: booking?.date ?? draft?.date ?? today ?? '',
    startTime: booking ? formatTime(booking.start_time) : draft?.startTime ?? '',
    endTime: booking ? formatTime(booking.end_time) : draft?.endTime ?? '',
    status: booking?.status ?? 'approved',
    details: booking?.details ?? '',
});

const NO_MONEY = { changing: false, price: '', priceNote: '', status: 'approved', paidKind: 'none', other: '', method: 'cash', paymentNote: '' };
// Quick lengths from the start time, in minutes.
const LENGTHS = [
    { minutes: 60, label: '1 h' },
    { minutes: 90, label: '1.5 h' },
    { minutes: 120, label: '2 h' },
    { minutes: 180, label: '3 h' },
];
const CLOSING = 22 * 60;
const studioNow = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());

const Section = ({ icon: Icon, title, aside, children }) => (
    <section className="bfSection">
        <header className="bfSectionHead">
            <span className="bfSectionIcon" aria-hidden="true">
                <Icon />
            </span>
            <h3>{title}</h3>
            {aside}
        </header>
        {children}
    </section>
);

// Staff create (for anyone with an account — `people` — or for a walk-in: name and phone, no account) or edit a
// booking. `booking` = null means create (prefilled from `draft`).
// Left, what is booked: who, the room and the times, a weekly repeat (a regular rental, paid by month), the money
// and notes. Right, the day of every room (`bookings` + that day's class sessions, loaded here) with the booking
// drawn in: green when its room is free then, red with what holds it — a slot that is taken can't be saved. A
// series shows its days on a month calendar instead, each checked on the server, with a choice for each taken day.
// Create: the server prices it from the room (or another agreed price with its reason), sets its payment
// code and records money taken now, all in one go (staffCreateBooking); onSaved(created, { taken }).
// Edit: guest, room, date, times, status and details only — money changes through the booking dialog's
// Record payment / Change price, so every amount has a line in its history; onSaved(updated).
// onOpenBooking(booking) opens a booking that holds the slot.
const BookingForm = ({ booking, draft, rooms, people, bookings = [], roomColor = new Map(), today: todayProp, onOpenBooking, onClose, onSaved }) => {
    const toast = useToast();
    const { t, tn, formatDate } = useI18n();
    const today = todayProp ?? studioTodayIso();
    const now = studioNow();
    const isNew = !booking;
    const [form, setForm] = useState(() => initialForm(booking, draft, isNew ? today : null));
    const [money, setMoney] = useState(NO_MONEY);
    const [saving, setSaving] = useState(false);
    // A new booking repeated every week (a series, paid by month), and the day of it the preview shows.
    const [repeat, setRepeat] = useState(false);
    const [pickedDay, setPickedDay] = useState(null);

    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
    const roomList = useMemo(() => [...rooms].sort(byRoomId), [rooms]);
    const timeError = form.startTime && form.endTime && toMinutes(form.startTime) >= toMinutes(form.endTime)
        ? t('End time must be after start time.')
        : '';
    const room = roomList.find((item) => String(item.id) === form.roomId);
    const length = form.startTime && form.endTime && !timeError ? toMinutes(form.endTime) - toMinutes(form.startTime) : null;
    const hours = length === null ? null : length / 60;
    const list = timeError ? null : listPriceFor(room, form.startTime, form.endTime);
    const slotReady = Boolean(form.roomId && form.date && form.startTime && form.endTime && !timeError);

    const series = useSeriesPlan({ active: isNew && repeat, rooms: roomList, roomId: form.roomId, date: form.date, startTime: form.startTime, endTime: form.endTime, t });
    // The day on the preview: the booking's; for a series the day picked on its month (the first taken day at first).
    const seriesDay = repeat ? series.days.find((day) => day.date === pickedDay) ?? series.days.find((day) => day.clash) ?? series.days[0] ?? null : null;
    const shownDay = seriesDay?.date ?? form.date;
    const daySessions = useAsync(() => (shownDay ? listRoomSessions({ from: shownDay, until: shownDay }) : Promise.resolve([])), [shownDay]);
    const sessions = (daySessions.data ?? []).filter((session) => session.date === shownDay);
    const checking = daySessions.loading;

    // One booking: what holds its room then, and which rooms are free instead.
    const slot = { roomId: form.roomId, date: form.date, start: form.startTime, end: form.endTime, skipId: booking?.id };
    const clashes = slotReady ? slotClashes({ bookings, sessions, ...slot }) : [];
    const freeRooms = clashes.length ? roomList.filter((other) => String(other.id) !== form.roomId && slotClashes({ bookings, sessions, ...slot, roomId: other.id }).length === 0) : [];
    const past = isNew && slotReady && (form.date < today || (form.date === today && form.startTime < now));

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
    const walkIn = form.who === 'walkin';
    const phoneError = walkIn && form.walkInPhone.trim() && !PHONE_PATTERN.test(form.walkInPhone.trim()) ? t('Enter a phone number (6–20 digits).') : '';
    const whoReady = walkIn ? Boolean(form.walkInName.trim() && form.walkInPhone.trim()) && !phoneError : !isNew || Boolean(form.guestId);
    const canSave = repeat
        ? whoReady && !series.problem
        : whoReady && slotReady && !moneyError && !past && !checking && clashes.length === 0;

    // Edit: what happens to the price when the room or the times move (the server recomputes the list
    // price; the agreed price follows it unless staff changed it by hand).
    const moved = !isNew && (form.roomId !== String(booking.room_id) || form.startTime !== formatTime(booking.start_time) || form.endTime !== formatTime(booking.end_time));
    const byHand = !isNew && booking.list_price !== null && booking.list_price !== undefined && Number(booking.full_payment) !== Number(booking.list_price);

    // The preview picks the room and the times (a drag), or the room alone (its name); a click keeps the length.
    const pickSlot = ({ roomId, start, end }) =>
        setForm((prev) => {
            const kept = prev.startTime && prev.endTime && toMinutes(prev.endTime) > toMinutes(prev.startTime) ? toMinutes(prev.endTime) - toMinutes(prev.startTime) : 60;
            return { ...prev, roomId: String(roomId), startTime: start, endTime: end ?? timeOf(Math.min(toMinutes(start) + kept, CLOSING)) };
        });
    // The rooms are one radio group: arrows move the choice (and the focus) to the next or previous room.
    const roomKeys = (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step || !roomList.length) return;
        event.preventDefault();
        const at = roomList.findIndex((item) => String(item.id) === form.roomId);
        const next = (at + step + roomList.length) % roomList.length;
        set('roomId')(String(roomList[next].id));
        event.currentTarget.querySelectorAll('[role="radio"]')[next]?.focus();
    };
    const setLength = (minutes) => setForm((prev) => ({ ...prev, endTime: timeOf(toMinutes(prev.startTime) + minutes) }));

    const handleSubmit = async () => {
        setSaving(true);
        try {
            if (isNew && repeat) {
                const { first } = await createSeries({
                    ...(walkIn ? { walkInName: form.walkInName, walkInPhone: form.walkInPhone } : { guestId: form.guestId }),
                    roomId: form.roomId,
                    weekdays: series.plan.weekdays,
                    start: form.startTime,
                    end: form.endTime,
                    from: form.date,
                    until: series.plan.until,
                    days: series.plan.days,
                    discount: series.plan.discount,
                    details: form.details,
                });
                toast.success(t('Booked {count} sessions, paid by month.', { count: series.plan.count }));
                onSaved(first, { series: true });
            } else if (isNew) {
                const created = await staffCreateBooking({
                    ...(walkIn ? { walkInName: form.walkInName, walkInPhone: form.walkInPhone } : { guestId: form.guestId }),
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
                // Who it is for doesn't change, but a walk-in's name and phone can be corrected.
                const fields = {
                    roomId: Number(form.roomId),
                    date: form.date,
                    startTime: form.startTime,
                    endTime: form.endTime,
                    status: form.status,
                    details: form.details,
                    ...(isWalkIn(booking) ? { walkInName: form.walkInName, walkInPhone: form.walkInPhone } : {}),
                };
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
        : repeat
        ? t('Book {count} sessions', { count: series.plan.count })
        : taken > 0
            ? t('Add Booking · {amount} taken in {method}', { amount: formatVnd(taken), method: money.method === 'cash' ? t('cash') : t('transfer') })
            : t('Add Booking');

    // The footer says what is about to be booked.
    const summary = repeat
        ? series.kept.length
            ? [tn(series.kept.length, '{count} session', '{count} sessions'), room?.name, `${form.startTime}–${form.endTime}`, formatVnd(series.total)].filter(Boolean).join(' · ')
            : ''
        : slotReady
            ? [room?.name, formatDate(form.date, 'short'), `${form.startTime}–${form.endTime}`, isNew && total !== null ? formatVnd(total) : null].filter(Boolean).join(' · ')
            : '';

    // The preview's day arrows: a day earlier or later (a new booking not before today); a series goes from one of
    // its days to the next.
    const at = seriesDay ? series.days.indexOf(seriesDay) : -1;
    const nav = repeat
        ? {
            prevLabel: t('Previous day of the series'),
            nextLabel: t('Next day of the series'),
            onPrev: at > 0 ? () => setPickedDay(series.days[at - 1].date) : null,
            onNext: at >= 0 && at < series.days.length - 1 ? () => setPickedDay(series.days[at + 1].date) : null,
        }
        : {
            prevLabel: t('Previous day'),
            nextLabel: t('Next day'),
            onPrev: form.date && (!isNew || form.date > today) ? () => set('date')(plusDays(form.date, -1)) : null,
            onNext: form.date ? () => set('date')(plusDays(form.date, 1)) : null,
        };
    const previewSlot = seriesDay
        ? seriesDay.status === 'skipped' ? null : { roomId: seriesDay.roomId, start: seriesDay.start, end: seriesDay.end }
        : { roomId: form.roomId, start: form.startTime, end: form.endTime };
    const caption = repeat && seriesDay
        ? { free: t('Free'), moved: seriesDay.otherRoom ? t('In another room that day') : t('At other times that day'), clash: t('Still clashes'), skipped: t('Skipped') }[seriesDay.status]
        : null;

    return (
        <Modal
            isOpen
            size="5xl"
            scrollBehavior="inside"
            onOpenChange={(open) => !open && onClose()}
            classNames={{ base: 'bookingForm adminPortal', header: 'bfHead', body: 'bfBody', footer: 'bfFoot' }}
        >
            <ModalContent>
                <ModalHeader>
                    <span className="bfHeadIcon" aria-hidden="true">
                        {isNew ? <LuCalendarPlus /> : <LuPencil />}
                    </span>
                    <div className="bfHeadText">
                        <h2>{isNew ? t('Add Booking') : t('Edit Booking #{id}', { id: booking.id })}</h2>
                        <p>{isNew ? t('Who, which room and when — the calendar checks it’s free as you go.') : t('Move it or change its details; the calendar checks the new slot.')}</p>
                    </div>
                </ModalHeader>
                <ModalBody>
                    <div className="bfMain">
                        <Section icon={LuUser} title={t('Booking for')}>
                            {isNew && (
                                <Segmented
                                    label={t('Booking for')}
                                    options={[
                                        { key: 'account', label: t('An account') },
                                        { key: 'walkin', label: t('A walk-in (no account)') },
                                    ]}
                                    value={form.who}
                                    onChange={set('who')}
                                    className="bfWho"
                                />
                            )}
                            {walkIn ? (
                                <div className="bfGrid2">
                                    <Input label={t('Walk-in’s name')} isRequired value={form.walkInName} onValueChange={set('walkInName')} maxLength={80} autoFocus={isNew} />
                                    <Input
                                        label={t('Phone')}
                                        type="tel"
                                        isRequired
                                        value={form.walkInPhone}
                                        onValueChange={set('walkInPhone')}
                                        maxLength={20}
                                        isInvalid={Boolean(phoneError)}
                                        errorMessage={phoneError || undefined}
                                        description={t('To reach them about the booking; they have no account.')}
                                    />
                                </div>
                            ) : isNew ? (
                                <PersonAutocomplete label={t('Guest')} people={people} value={form.guestId} onChange={set('guestId')} isRequired showRole />
                            ) : (
                                <p className="bfGuest">
                                    {t('Guest:')} <strong>{booking.guest?.full_name || booking.guest?.username || booking.guest?.email}</strong>
                                </p>
                            )}
                        </Section>

                        <Section icon={LuDoorOpen} title={t('Room and time')}>
                            <div className="bfRooms" role="radiogroup" aria-label={t('Room')} onKeyDown={roomKeys}>
                                {roomList.map((item, index) => {
                                    const picked = String(item.id) === form.roomId;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={picked}
                                            tabIndex={picked || (!room && index === 0) ? 0 : -1}
                                            className="bfRoom"
                                            style={{ '--room': roomColor.get(item.id) ?? 'hsl(0, 66%, 43%)' }}
                                            onClick={() => set('roomId')(String(item.id))}
                                        >
                                            <i className="bfRoomDot" aria-hidden="true" />
                                            <span>
                                                <strong>{item.name}</strong>
                                                <small>{t('{price}/h', { price: formatVnd(item.price ?? 0) })}</small>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="bfGrid3">
                                <Input label={repeat ? t('Starts on') : t('Date')} type="date" isRequired value={form.date} min={isNew ? today : undefined} onValueChange={set('date')} />
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
                            </div>
                            {form.startTime && (
                                <div className="bfLengthRow">
                                    <span className="bfLabel">{t('Length')}</span>
                                    <div className="bfChips" role="group" aria-label={t('Length')}>
                                        {LENGTHS.map((option) => (
                                            <button
                                                key={option.minutes}
                                                type="button"
                                                aria-pressed={length === option.minutes}
                                                disabled={toMinutes(form.startTime) + option.minutes > CLOSING}
                                                onClick={() => setLength(option.minutes)}
                                            >
                                                {t(option.label)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {!isNew && (
                                <Select
                                    label={t('Status')}
                                    selectedKeys={[form.status]}
                                    onChange={(event) => event.target.value && set('status')(event.target.value)}
                                    className="bfStatus"
                                >
                                    {BOOKING_STATUSES.map((status) => (
                                        <SelectItem key={status} className="capitalize">{t(status)}</SelectItem>
                                    ))}
                                </Select>
                            )}
                            {moved && list !== null && (
                                <p className="bfHint" role="status">
                                    {byHand
                                        ? t('The agreed price stays {amount} (changed by hand).', { amount: formatVnd(booking.full_payment) })
                                        : t('The price follows the new times: {amount}.', { amount: formatVnd(list) })}
                                </p>
                            )}
                        </Section>

                        {isNew && (
                            <Section
                                icon={LuRepeat}
                                title={t('Repeat')}
                                aside={
                                    <Switch size="sm" isSelected={repeat} onValueChange={setRepeat} className="bfRepeat" aria-label={t('Repeat every week (a regular rental, paid by month)')}>
                                        {t('Every week')}
                                    </Switch>
                                }
                            >
                                {repeat ? (
                                    <RepeatFields series={series} date={form.date} />
                                ) : (
                                    <p className="bfMuted">{t('A regular rental: the same room every week, with a discount if agreed, paid by month.')}</p>
                                )}
                            </Section>
                        )}

                        {isNew && !repeat && (
                            <Section icon={LuWallet} title={t('Payment')}>
                                <NewBookingMoney room={room} hours={hours} list={list} money={money} set={(patch) => setMoney((prev) => ({ ...prev, ...patch }))} />
                            </Section>
                        )}

                        <Section icon={LuStickyNote} title={t('Notes')}>
                            <Textarea label={t('Details')} placeholder={t('Optional')} value={form.details} onValueChange={set('details')} minRows={2} />
                        </Section>
                    </div>

                    <aside className="bfSide" aria-label={t('Is it free?')}>
                        {repeat ? (
                            <SeriesCheck series={series} room={room} date={form.date} start={form.startTime} end={form.endTime} />
                        ) : (
                            <SingleCheck
                                ready={slotReady}
                                checking={checking}
                                past={past}
                                room={room}
                                date={form.date}
                                start={form.startTime}
                                end={form.endTime}
                                clashes={clashes}
                                freeRooms={freeRooms}
                                onRoom={set('roomId')}
                                onOpenBooking={onOpenBooking}
                            />
                        )}
                        {repeat && series.ready && !series.loading && series.days.length > 0 && (
                            <SeriesDays series={series} roomId={form.roomId} bookings={bookings} selected={seriesDay?.date} onSelect={setPickedDay} />
                        )}
                        <DayPreview
                            date={shownDay}
                            rooms={roomList}
                            roomColor={roomColor}
                            bookings={bookings}
                            sessions={sessions}
                            skipId={booking?.id}
                            slot={previewSlot}
                            today={today}
                            now={now}
                            onPick={pickSlot}
                            onRoom={set('roomId')}
                            nav={nav}
                            caption={caption}
                            ghostLabel={isNew ? t('This booking') : t('Booking #{id}', { id: booking.id })}
                        />
                    </aside>
                </ModalBody>
                <ModalFooter>
                    <p className="bfSummary">{summary}</p>
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
