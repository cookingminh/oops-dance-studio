import { useI18n } from '@/i18n/i18nContext';
import CalendarView from '../../../../common/calendar/CalendarView';
import { bookingItem, sessionItem } from '../../bookingsModel';

// Bookings on the shared calendar, in their room's colour, with the rooms' class sessions behind
// them (context, not clickable). A click on a booking opens it; a free slot starts a new one.
const BookingCalendar = ({ bookings, sessions, roomColor, view, date, onViewChange, onDateChange, today, loading, onOpen, onSlot }) => {
    const { t } = useI18n();
    const items = [
        ...sessions.map((session) => sessionItem(session, { roomColor, t })),
        ...bookings.map((booking) => bookingItem(booking, { roomColor, t })),
    ];

    return (
        <CalendarView
            view={view}
            onViewChange={onViewChange}
            date={date}
            onDateChange={onDateChange}
            items={items}
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
