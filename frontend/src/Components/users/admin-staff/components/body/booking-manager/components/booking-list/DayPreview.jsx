import { Button } from '@nextui-org/react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import WeekTrack from '../../../../common/calendar/WeekTrack';
import { useSlotDrag } from '../../../../common/calendar/useSlotDrag';
import { SLOT_MINUTES, minutesOf, timeOf } from '../../../../common/calendar/calendarModel';
import { bookingItem, holdsRoom, sessionItem } from '../../bookingsModel';

// Opening hours, as the booking times go (08:00–22:00).
const RANGE = { start: 8 * 60, end: 22 * 60 };
const SLOTS = Array.from({ length: (RANGE.end - RANGE.start) / SLOT_MINUTES }, (_, index) => timeOf(RANGE.start + index * SLOT_MINUTES));
const HOURS = Array.from({ length: (RANGE.end - RANGE.start) / 60 }, (_, index) => RANGE.start / 60 + index);

// One day of every room, side by side (the booking form's preview): what already holds each room — bookings that
// still hold it and class sessions — and the booking being made as a ghost in its room, green when that room is
// free then, red with what it overlaps. `slot` = { roomId, start, end } (null: nothing to show yet). A press and
// drag on free time (or a click) picks the room and the times: onPick({ roomId, start, end? }); a room's name picks
// the room: onRoom(roomId). `skipId` leaves out the booking being edited (the ghost stands for it).
const DayPreview = ({ date, rooms, roomColor, bookings, sessions, skipId, slot, today, now, onPick, onRoom, nav, caption, ghostLabel }) => {
    const { t, formatDate } = useI18n();
    const { drag, handlersFor } = useSlotDrag({
        range: RANGE,
        onPick: onPick ? (_day, start, { lane, end }) => onPick({ roomId: lane, start, end }) : undefined,
    });

    const items = [
        ...bookings
            .filter((booking) => booking.date === date && booking.id !== skipId && holdsRoom(booking))
            .map((booking) => bookingItem(booking, { roomColor, t, withRoom: false, today })),
        ...sessions.filter((session) => session.date === date).map((session) => sessionItem(session, { roomColor, t, withRoom: false })),
    ];
    const valid = slot?.roomId && slot.start && slot.end && minutesOf(slot.end) > minutesOf(slot.start);
    const held = valid ? { date, lane: String(slot.roomId), from: minutesOf(slot.start), to: minutesOf(slot.end) } : null;
    const past = date < today;
    const nowAt = date === today && minutesOf(now) > RANGE.start && minutesOf(now) < RANGE.end ? minutesOf(now) : null;

    return (
        <div className="calendarView bfDay">
            <div className="bfDayBar">
                {nav && (
                    <Button isIconOnly size="sm" variant="light" aria-label={nav.prevLabel} onPress={nav.onPrev} isDisabled={!nav.onPrev}>
                        <LuChevronLeft aria-hidden="true" />
                    </Button>
                )}
                <p className="bfDayTitle">
                    <strong>{date ? formatDate(date, 'full') : t('Pick a day')}</strong>
                    {date === today && <span className="bfDayTag">{t('Today')}</span>}
                    {caption && <span className="bfDayCaption">{caption}</span>}
                </p>
                {nav && (
                    <Button isIconOnly size="sm" variant="light" aria-label={nav.nextLabel} onPress={nav.onNext} isDisabled={!nav.onNext}>
                        <LuChevronRight aria-hidden="true" />
                    </Button>
                )}
            </div>

            <div className={`bfDayGrid${drag ? ' isDragging' : ''}`} style={{ '--cal-lanes': rooms.length }}>
                <div className="bfDayHead">
                    <span aria-hidden="true" />
                    {rooms.map((room) => {
                        const picked = String(room.id) === String(slot?.roomId);
                        return (
                            <button
                                key={room.id}
                                type="button"
                                className={`bfLaneHead${picked ? ' isPicked' : ''}`}
                                style={{ '--cal-accent': roomColor.get(room.id) }}
                                aria-pressed={picked}
                                onClick={() => onRoom?.(String(room.id))}
                                disabled={!onRoom}
                            >
                                <i className="calDot" aria-hidden="true" />
                                <b>{room.name}</b>
                            </button>
                        );
                    })}
                </div>
                <div className="bfDayBody">
                    <div className="calTimes" aria-hidden="true">
                        {HOURS.map((hour) => (
                            <span key={hour} style={{ top: `${((hour * 60 - RANGE.start) / (RANGE.end - RANGE.start)) * 100}%` }}>
                                {timeOf(hour * 60)}
                            </span>
                        ))}
                    </div>
                    <div className={`bfLanes${past ? ' isPast' : ''}`}>
                        {rooms.map((room) => {
                            const lane = { id: String(room.id), label: room.name };
                            return (
                                <WeekTrack
                                    key={room.id}
                                    className="calLane"
                                    date={date}
                                    lane={lane}
                                    items={items.filter((item) => item.lane === lane.id)}
                                    slots={SLOTS}
                                    range={RANGE}
                                    selectable={Boolean(onPick) && !past}
                                    slotLabel={t('Book')}
                                    drag={drag ?? held}
                                    held={!drag && Boolean(held)}
                                    ghostLabel={ghostLabel}
                                    handlers={past ? {} : handlersFor(date, lane.id)}
                                    data-lane={lane.id}
                                    role="group"
                                    aria-label={room.name}
                                />
                            );
                        })}
                        {nowAt !== null && (
                            <span className="calNow" style={{ top: `${((nowAt - RANGE.start) / (RANGE.end - RANGE.start)) * 100}%` }} aria-hidden="true" />
                        )}
                    </div>
                </div>
            </div>

            <ul className="bfDayLegend" aria-label={t('Legend')}>
                <li>
                    <i className="isBooking" aria-hidden="true" />
                    {t('Bookings')}
                </li>
                <li>
                    <i className="isClass" aria-hidden="true" />
                    {t('Class')}
                </li>
                <li>
                    <i className="isYours" aria-hidden="true" />
                    {ghostLabel}
                </li>
                {onPick && !past && <li className="bfDayTip">{t('Drag on free time to pick the room and the times.')}</li>}
            </ul>
        </div>
    );
};

export default DayPreview;
