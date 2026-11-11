import { useI18n } from '@/i18n/i18nContext';
import CalendarView from '../../../../common/calendar/CalendarView';
import { changeDay } from '../../../../common/session-changes/changeText';
import { bookingItem, sessionItem } from '../../bookingsModel';

// Bookings on the shared calendar, in their room's colour, with the rooms' class sessions behind
// them (context, not clickable). With `lanes` (All rooms) each day is split into one column per room.
// A booking paid in full ahead stays solid with a "Paid up" badge (bookingItem).
// A click on a booking opens it; a click or a press-and-drag on free slots starts a new one.
const BookingCalendar = ({ bookings, sessions, roomColor, lanes, view, date, onViewChange, onDateChange, today, loading, onOpen, onSlot }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const withRoom = !lanes;
    const day = (value) => changeDay(value, i18n, { short: true });
    const items = [
        ...sessions.map((session) => sessionItem(session, { roomColor, t, withRoom, day })),
        ...bookings.map((booking) => bookingItem(booking, { roomColor, t, withRoom, today })),
    ];

    return (
        <CalendarView
            view={view}
            onViewChange={onViewChange}
            date={date}
            onDateChange={onDateChange}
            items={items}
            lanes={lanes}
            onSelect={(item) => onOpen(item.data)}
            onSlotClick={onSlot}
            today={today}
            loading={loading}
            label={t('Bookings calendar')}
            slotLabel={t('New booking')}
            className="bookingCalendar"
        />
    );
};

export default BookingCalendar;
