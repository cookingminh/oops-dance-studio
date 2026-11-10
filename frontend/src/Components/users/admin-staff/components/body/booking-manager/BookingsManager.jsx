import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Input } from '@nextui-org/react';
import { LuPlus, LuSearch, LuTicket } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listBookings } from '@/services/bookings';
import { listRoomSessions } from '@/services/bookingsExtra';
import { listRooms } from '@/services/rooms';
import { getProfile, listGuests } from '@/services/users';
import { getStudioToday } from '@/services/studio';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { STATUS_COLORS, roomColorMap } from '../../common/chartTheme';
import { asDate, calendarRange, studioTodayIso } from '../../common/calendar/calendarModel';
import BookingFilters from './components/BookingFilters';
import BookingList from './components/booking-list/BookingList';
import BookingForm from './components/booking-list/BookingForm';
import BookingCalendar from './components/booking-calendar/BookingCalendar';
import BookingDetails from './components/booking-calendar/BookingDetails';
import { PAGE_SIZE, STATUS_FILTERS, byRoomId, capitalize, countBy, periodOf, slotDraft, soonestFirst } from './bookingsModel';
import { useBookingActions } from './useBookingActions';
import './bookings.scss';

const inRange = ({ from, until }) => (booking) => booking.date >= from && booking.date <= until;

// /admin/bookings: every room booking as a calendar (default; week or month, with the rooms' class
// sessions behind) or as the searchable table. Room and status filters apply to both; the header
// counts what is shown. `?view=list|month`, `?status=pending` and `?date=yyyy-MM-dd` open it pre-set.
const BookingsManager = () => {
    const toast = useToast();
    const { t, tn, formatDate, monthName } = useI18n();
    const [params, setParams] = useSearchParams();
    const bookings = useAsync(listBookings, []);
    const rooms = useAsync(listRooms, []);
    const guests = useAsync(listGuests, []);
    const today = useAsync(getStudioToday, []);
    const todayIso = today.data ?? studioTodayIso();

    // Layout: the URL keeps it, so a reload (or a link) opens the same view.
    const view = ['list', 'month'].includes(params.get('view')) ? params.get('view') : 'week';
    const isList = view === 'list';
    const lastCalendar = useRef(view === 'month' ? 'month' : 'week');
    if (!isList) lastCalendar.current = view;
    const calView = lastCalendar.current;
    const setView = (next) =>
        setParams(
            (prev) => {
                const copy = new URLSearchParams(prev);
                if (next === 'week') copy.delete('view');
                else copy.set('view', next);
                return copy;
            },
            { replace: true }
        );

    const [calDate, setCalDate] = useState(() => asDate(/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date') : studioTodayIso()));
    const [roomFilter, setRoomFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState(() => (STATUS_FILTERS.includes(params.get('status')) ? params.get('status') : 'all'));
    const [scope, setScope] = useState('upcoming');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, row = edit
    const [draft, setDraft] = useState(null); // prefill of a new booking (free slot)
    const [openId, setOpenId] = useState(null); // booking shown in the details dialog

    const actions = useBookingActions(bookings.reload);

    // Class sessions behind the calendar, for the days it shows.
    const shown = calendarRange(calView, calDate);
    const sessions = useAsync(() => (isList ? Promise.resolve([]) : listRoomSessions(shown)), [isList, shown.from, shown.until]);

    // Any filter change starts the table again from its first page.
    const filterSetter = (setter) => (value) => {
        setter(value);
        setPage(1);
    };

    const roomList = [...(rooms.data ?? [])].sort(byRoomId);
    const roomColor = roomColorMap(roomList);
    const roomMatches = (item) => roomFilter === 'all' || String(item.room_id) === roomFilter;
    const statusMatches = (booking) => statusFilter === 'all' || booking.status === statusFilter;

    // What the facets count: the table's date scope + search, or the calendar's week / month.
    const term = query.trim().toLowerCase();
    const period = periodOf(calView, calDate);
    const all = bookings.data ?? [];
    const base = isList
        ? all.filter((booking) => {
            if (today.data && scope === 'upcoming' && booking.date < todayIso) return false;
            if (today.data && scope === 'past' && booking.date >= todayIso) return false;
            if (!term) return true;
            return [booking.guest?.full_name, booking.guest?.username, booking.guest?.email, booking.room?.name, booking.date, `#${booking.id}`, booking.details]
                .some((value) => String(value ?? '').toLowerCase().includes(term));
        })
        : all.filter(inRange(period));

    const roomCounts = countBy(base.filter(statusMatches), (booking) => String(booking.room_id));
    const statusCounts = countBy(base.filter(roomMatches), (booking) => booking.status);
    const pendingCount = statusCounts.get('pending') ?? 0;
    const visible = base.filter(roomMatches).filter(statusMatches);
    visible.sort(scope === 'upcoming' ? soonestFirst : (a, b) => soonestFirst(b, a));

    const roomOptions = [
        { key: 'all', label: t('All rooms'), count: [...roomCounts.values()].reduce((sum, n) => sum + n, 0) },
        ...roomList.map((room) => ({ key: String(room.id), label: room.name, count: roomCounts.get(String(room.id)) ?? 0, color: roomColor.get(room.id) })),
    ];
    const statusOptions = STATUS_FILTERS.map((status) => ({
        key: status,
        label: t(status === 'all' ? 'Any status' : capitalize(status)),
        count: status === 'all' ? base.filter(roomMatches).length : statusCounts.get(status) ?? 0,
        color: STATUS_COLORS[status],
    }));

    // Table: "5 upcoming pending bookings in all rooms" (scope and status words only when filtered).
    const listSummary = (count) => {
        const byScope = scope !== 'all';
        const byStatus = statusFilter !== 'all';
        const vars = {
            room: roomFilter === 'all' ? t('all rooms') : roomList.find((room) => String(room.id) === roomFilter)?.name,
            scope: byScope ? t(scope) : '',
            status: byStatus ? t(statusFilter) : '',
        };
        if (byScope && byStatus) return tn(count, '{count} {scope} {status} booking in {room}', '{count} {scope} {status} bookings in {room}', vars);
        if (byScope) return tn(count, '{count} {scope} booking in {room}', '{count} {scope} bookings in {room}', vars);
        if (byStatus) return tn(count, '{count} {status} booking in {room}', '{count} {status} bookings in {room}', vars);
        return tn(count, '{count} booking in {room}', '{count} bookings in {room}', vars);
    };
    // Calendar: "12 bookings this week · 3 awaiting approval".
    const calendarSummary = (count) => {
        const current = todayIso >= period.from && todayIso <= period.until;
        let text;
        if (calView === 'month') {
            text = current
                ? tn(count, '{count} booking this month', '{count} bookings this month')
                : tn(count, '{count} booking in {month}', '{count} bookings in {month}', { month: monthName(period.from, { withYear: true }) });
        } else {
            text = current
                ? tn(count, '{count} booking this week', '{count} bookings this week')
                : tn(count, '{count} booking in the week of {date}', '{count} bookings in the week of {date}', { date: formatDate(period.from, 'dayMonth') });
        }
        return pendingCount && statusFilter !== 'pending' ? `${text} · ${t('{count} awaiting approval', { count: pendingCount })}` : text;
    };
    let summary = t('Loading bookings…');
    if (bookings.data) summary = isList ? listSummary(visible.length) : calendarSummary(visible.length);

    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);

    const clearFilters = () => {
        setRoomFilter('all');
        setStatusFilter('all');
        setScope('all');
        setQuery('');
        setPage(1);
    };

    // Calendar inputs: bookings of every day on screen, sessions of the shown rooms.
    const calendarBookings = isList ? [] : all.filter(inRange(shown)).filter(roomMatches).filter(statusMatches);
    const calendarSessions = (sessions.data ?? []).filter(roomMatches);

    const newBooking = (prefill = null) => {
        setDraft(prefill);
        setEditing(null);
    };
    const pickSlot = (date, time) => {
        if (date < todayIso) {
            toast.error('That date is in the past. Please choose today or a later date.');
            return;
        }
        newBooking(slotDraft({ date, time, roomId: roomFilter === 'all' ? null : roomFilter }));
    };

    const opened = openId ? all.find((booking) => booking.id === openId) : null;
    const openedGuestId = opened?.guest_id;
    const listedPhone = guests.data?.find((guest) => guest.id === openedGuestId)?.contact_number;
    // A booking's guest may not be on the guest list (another role): fetch their profile then.
    const profile = useAsync(
        () => (openedGuestId && guests.data && !guests.data.some((guest) => guest.id === openedGuestId) ? getProfile(openedGuestId) : Promise.resolve(null)),
        [openedGuestId, Boolean(guests.data)]
    );

    return (
        <SectionCard
            className="bookingsCard"
            icon={LuTicket}
            title={t('Bookings')}
            subtitle={summary}
            actions={
                <>
                    {isList && (
                        <Input
                            isClearable
                            aria-label={t('Search bookings')}
                            placeholder={t('Search...')}
                            className="bookingSearch"
                            startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                            value={query}
                            onValueChange={filterSetter(setQuery)}
                            onClear={() => filterSetter(setQuery)('')}
                        />
                    )}
                    <Segmented
                        label={t('Layout')}
                        className="bookingLayout"
                        options={[
                            { key: 'calendar', label: t('Calendar') },
                            { key: 'list', label: t('List') },
                        ]}
                        value={isList ? 'list' : 'calendar'}
                        onChange={(key) => setView(key === 'list' ? 'list' : lastCalendar.current)}
                    />
                    <Button color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={() => newBooking()}>
                        {t('New booking')}
                    </Button>
                </>
            }
        >
            <BookingFilters
                roomOptions={roomOptions}
                room={roomFilter}
                onRoom={filterSetter(setRoomFilter)}
                statusOptions={statusOptions}
                status={statusFilter}
                onStatus={filterSetter(setStatusFilter)}
                pendingCount={pendingCount}
                scope={isList ? scope : null}
                onScope={filterSetter(setScope)}
            />

            {isList ? (
                <BookingList
                    state={bookings}
                    rows={visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
                    total={visible.length}
                    page={currentPage}
                    onPage={setPage}
                    todayIso={today.data}
                    roomColor={roomColor}
                    actions={actions}
                    onOpen={(booking) => setOpenId(booking.id)}
                    onEdit={setEditing}
                    onClearFilters={clearFilters}
                />
            ) : (
                <BookingCalendar
                    bookings={calendarBookings}
                    sessions={calendarSessions}
                    roomColor={roomColor}
                    view={calView}
                    date={calDate}
                    onViewChange={setView}
                    onDateChange={setCalDate}
                    today={todayIso}
                    loading={bookings.loading || sessions.loading}
                    onOpen={(booking) => setOpenId(booking.id)}
                    onSlot={pickSlot}
                />
            )}

            {opened && (
                <BookingDetails
                    booking={opened}
                    phone={listedPhone ?? profile.data?.contact_number}
                    roomColor={roomColor}
                    actions={actions}
                    onEdit={(booking) => {
                        setOpenId(null);
                        setEditing(booking);
                    }}
                    onClose={() => setOpenId(null)}
                />
            )}

            {editing !== undefined && (
                <BookingForm
                    booking={editing}
                    draft={editing ? undefined : draft}
                    rooms={rooms.data ?? []}
                    guests={guests.data ?? []}
                    onClose={() => setEditing(undefined)}
                    onSaved={() => {
                        setEditing(undefined);
                        bookings.reload();
                    }}
                />
            )}
        </SectionCard>
    );
};

export default BookingsManager;
