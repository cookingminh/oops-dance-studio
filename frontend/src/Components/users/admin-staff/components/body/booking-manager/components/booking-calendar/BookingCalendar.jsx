import { useI18n } from '@/i18n/i18nContext';
import CalendarView from '../../../../common/calendar/CalendarView';
import { bookingItem, sessionItem } from '../../bookingsModel';

// Bookings on the shared calendar, in their room's colour, with the rooms' class sessions behind
// them (context, not clickable). With `lanes` (All rooms) each day is split into one column per room.
// A click on a booking opens it; a click or a press-and-drag on free slots starts a new one.
const BookingCalendar = ({ bookings, sessions, roomColor, lanes, view, date, onViewChange, onDateChange, today, loading, onOpen, onSlot }) => {
    const { t } = useI18n();
    const withRoom = !lanes;
    const items = [
        ...sessions.map((session) => sessionItem(session, { roomColor, t, withRoom })),
        ...bookings.map((booking) => bookingItem(booking, { roomColor, t, withRoom })),
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
