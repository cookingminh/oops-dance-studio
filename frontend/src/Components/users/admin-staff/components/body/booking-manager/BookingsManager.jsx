import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@nextui-org/react';
import { LuPlus, LuTicket } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useAsync } from '@/hooks/useAsync';
import { listBookings } from '@/services/bookings';
import { listRoomSessions } from '@/services/bookingsExtra';
import { listRooms } from '@/services/rooms';
import { getProfile, listGuests } from '@/services/users';
import { getStudioToday } from '@/services/studio';
import { getTuitionSettings, isPaymentSandbox } from '@/services/tuition';
import { bookingBalance } from '@/services/bookingPayments';
import { getBookingSettings } from '@/services/bookingRefunds';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import SectionCard from '../../common/SectionCard';
import Segmented from '../../common/Segmented';
import { STATUS_COLORS, roomColorMap } from '../../common/chartTheme';
import { asDate, calendarRange, studioTodayIso } from '../../common/calendar/calendarModel';
import BookingFilters from './components/BookingFilters';
import RoomsView from './components/rooms/RoomsView';
import BookingList from './components/booking-list/BookingList';
import BookingForm from './components/booking-list/BookingForm';
import BookingCalendar from './components/booking-calendar/BookingCalendar';
import BookingDetails from './components/booking-calendar/BookingDetails';
import CompleteDialog from './components/booking-calendar/CompleteDialog';
import StaffCancelDialog from './components/refunds/StaffCancelDialog';
import RefundPolicyDialog from './components/refunds/RefundPolicyDialog';
import { PAGE_SIZE, STATUS_FILTERS, byRoomId, capitalize, countBy, isOwing, owesRefund, periodOf, roomLanes, slotDraft, soonestFirst } from './bookingsModel';
import { useBookingActions } from './useBookingActions';
import './bookings.scss';

const inRange = ({ from, until }) => (booking) => booking.date >= from && booking.date <= until;

// /admin/bookings: every room booking as a calendar (default; week or month, with the rooms' class
// sessions behind) or as the searchable table, and the rooms themselves — "Rooms & prices": each room's
// hourly price and how it is booked, beside the cancellation policy (once a page of its own; /admin/rooms
// leads here). Room and status filters apply to the calendar and the table; the header counts what is
// shown. `?view=list|month|rooms`, `?status=pending`, `?date=yyyy-MM-dd`, `?booking=<id>`, `?owing=1` /
// `?refunds=1` (list) and `?policy=1` (the cancellation policy dialog) open it pre-set.
const BookingsManager = () => {
    const toast = useToast();
    const { role } = useAuth();
    const { t, tn, formatDate, monthName } = useI18n();
    const [params, setParams] = useSearchParams();
    const bookings = useAsync(listBookings, []);
    const rooms = useAsync(listRooms, []);
    const guests = useAsync(listGuests, []);
    const today = useAsync(getStudioToday, []);
    // The bank account for the QR code, and whether simulated transfers work (local stack, demo).
    const payment = useAsync(() => Promise.all([getTuitionSettings(), isPaymentSandbox()]), []);
    // The cancellation policy (shown in "Rooms & prices"; admins change it there).
    const policy = useAsync(getBookingSettings, []);
    const [policyOpen, setPolicyOpen] = useState(() => params.get('policy') === '1');
    const todayIso = today.data ?? studioTodayIso();

    // Layout: the URL keeps it, so a reload (or a link) opens the same view.
    const view = ['list', 'month', 'rooms'].includes(params.get('view')) ? params.get('view') : 'week';
    const isList = view === 'list';
    const isRooms = view === 'rooms';
    const isCalendar = !isList && !isRooms;
    const lastCalendar = useRef(view === 'month' ? 'month' : 'week');
    if (isCalendar) lastCalendar.current = view;
    const calView = lastCalendar.current;
    const setView = (next, extra = {}) =>
        setParams(
            (prev) => {
                const copy = new URLSearchParams(prev);
                if (next === 'week') copy.delete('view');
                else copy.set('view', next);
                for (const [key, value] of Object.entries(extra)) {
                    if (value) copy.set(key, value);
                    else copy.delete(key);
                }
                return copy;
            },
            { replace: true }
        );
    // "Owes money" (?owing=1, list only): past bookings that still have a balance. "To refund" (?refunds=1,
    // list only): cancelled bookings with money still to give back. One at a time.
    const owing = isList && params.get('owing') === '1';
    const refunds = isList && !owing && params.get('refunds') === '1';

    const [calDate, setCalDate] = useState(() => asDate(/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date') : studioTodayIso()));
    const [roomFilter, setRoomFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState(() => (STATUS_FILTERS.includes(params.get('status')) ? params.get('status') : 'all'));
    const [scope, setScope] = useState('upcoming');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, row = edit
    const [draft, setDraft] = useState(null); // prefill of a new booking (free slot)
    const [openId, setOpenId] = useState(() => Number(params.get('booking')) || null); // booking in the details dialog (?booking=<id> opens it)
    const [openOn, setOpenOn] = useState(null); // 'pay': the dialog opens on its QR (a new booking with nothing taken)
    const [completing, setCompleting] = useState(null); // booking id waiting for the "still unpaid" prompt

    const setOwing = (on) => {
        setPage(1);
        setView(on ? 'list' : view, { owing: on ? '1' : null, refunds: null });
    };
    const setRefunds = (on) => {
        setPage(1);
        setView(on ? 'list' : view, { refunds: on ? '1' : null, owing: null });
    };

    const baseActions = useBookingActions(bookings.reload, todayIso);
    // Completing a booking that still owes money asks first (take it now, or complete anyway).
    const actions = {
        ...baseActions,
        setStatus: async (id, status) => {
            const target = (bookings.data ?? []).find((booking) => booking.id === id);
            if (status === 'completed' && target && bookingBalance(target) > 0) {
                setCompleting(id);
                return false;
            }
            return baseActions.setStatus(id, status);
        },
    };

    // ?booking=<id> without ?date: show that booking's week behind its dialog, once it is loaded. A link
    // followed while already on this page (a to-do) opens its booking too.
    const linkedId = Number(params.get('booking')) || null;
    const linkedWeek = useRef(!params.get('date') && linkedId);
    const lastLinked = useRef(linkedId);
    useEffect(() => {
        if (!linkedId || linkedId === lastLinked.current) return;
        lastLinked.current = linkedId;
        linkedWeek.current = params.get('date') ? null : linkedId;
        setOpenId(linkedId);
    }, [linkedId, params]);
    useEffect(() => {
        const linked = linkedWeek.current && bookings.data?.find((booking) => booking.id === linkedWeek.current);
        if (!linked) return;
        linkedWeek.current = null;
        setCalDate(asDate(linked.date));
    }, [bookings.data, linkedId]);

    // Class sessions behind the calendar, for the days it shows.
    const shown = calendarRange(calView, calDate);
    const sessions = useAsync(() => (isCalendar ? listRoomSessions(shown) : Promise.resolve([])), [isCalendar, shown.from, shown.until]);

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
    const owingCount = today.data ? all.filter((booking) => isOwing(booking, todayIso)).length : 0;
    const refundCount = all.filter(owesRefund).length;
    const base = owing
        ? all.filter((booking) => isOwing(booking, todayIso))
        : refunds
        ? all.filter(owesRefund)
        : isList
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
    if (isRooms) {
        summary = rooms.data
            ? `${tn(roomList.length, '{count} room', '{count} rooms')} · ${t('hourly prices and the cancellation policy')}`
            : t('Loading…');
    } else if (bookings.data) {
        summary = owing
            ? tn(visible.length, '{count} past booking still owes money', '{count} past bookings still owe money')
            : refunds
            ? tn(visible.length, '{count} cancelled booking to refund', '{count} cancelled bookings to refund')
            : isList
                ? listSummary(visible.length)
                : calendarSummary(visible.length);
    }

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
    const calendarBookings = isCalendar ? all.filter(inRange(shown)).filter(roomMatches).filter(statusMatches) : [];
    const calendarSessions = (sessions.data ?? []).filter(roomMatches);

    const newBooking = (prefill = null) => {
        setDraft(prefill);
        setEditing(null);
    };
    // "Rooms & prices" → that room alone on the calendar, this week.
    const showRoomCalendar = (room) => {
        setRoomFilter(String(room.id));
        setStatusFilter('all');
        setCalDate(asDate(todayIso));
        setView(lastCalendar.current);
    };
    // A free slot (click) or a dragged range, in a room lane or the selected room.
    const pickSlot = (date, time, { end, lane } = {}) => {
        if (date < todayIso) {
            toast.error('That date is in the past. Please choose today or a later date.');
            return;
        }
        newBooking(slotDraft({ date, time, end, roomId: lane ?? (roomFilter === 'all' ? null : roomFilter) }));
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
                    <Segmented
                        label={t('Layout')}
                        className="bookingLayout"
                        options={[
                            { key: 'calendar', label: t('Calendar') },
                            { key: 'list', label: t('List') },
                            {
                                key: 'rooms',
                                // Phones keep the short word so the three views fit beside "New booking".
                                label: (
                                    <>
                                        <span className="bookingViewLong">{t('Rooms & prices')}</span>
                                        <span className="bookingViewShort">{t('Rooms')}</span>
                                    </>
                                ),
                            },
                        ]}
                        value={isRooms ? 'rooms' : isList ? 'list' : 'calendar'}
                        onChange={(key) => setView(key === 'calendar' ? lastCalendar.current : key)}
                    />
                    <Button color="danger" className="bookingNewBtn" startContent={<LuPlus aria-hidden="true" />} onPress={() => newBooking()}>
                        <span className="bookingNewLabel">{t('New booking')}</span>
                    </Button>
                </>
            }
        >
            {!isRooms && (
                <BookingFilters
                    roomOptions={roomOptions}
                    room={roomFilter}
                    onRoom={filterSetter(setRoomFilter)}
                    statusOptions={statusOptions}
                    status={statusFilter}
                    onStatus={filterSetter(setStatusFilter)}
                    pendingCount={pendingCount}
                    owingCount={owingCount}
                    owing={owing}
                    onOwing={setOwing}
                    refundCount={refundCount}
                    refunds={refunds}
                    onRefunds={setRefunds}
                    search={isList && !owing && !refunds ? { value: query, onChange: filterSetter(setQuery) } : null}
                    scope={isList && !owing && !refunds ? scope : null}
                    onScope={filterSetter(setScope)}
                />
            )}

            {isRooms ? (
                <RoomsView
                    roomsState={rooms}
                    rooms={roomList}
                    bookings={all}
                    today={todayIso}
                    roomColor={roomColor}
                    policy={policy}
                    isAdmin={role === ROLES.admin}
                    onEditPolicy={() => setPolicyOpen(true)}
                    onCalendar={showRoomCalendar}
                    onOpenBooking={(booking) => setOpenId(booking.id)}
                    onRoomsChanged={rooms.reload}
                />
            ) : isList ? (
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
                    lanes={roomFilter === 'all' && roomList.length > 1 ? roomLanes(roomList, roomColor) : undefined}
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
                    settings={payment.data?.[0]}
                    sandbox={Boolean(payment.data?.[1])}
                    today={todayIso}
                    onRefresh={bookings.reload}
                    onEdit={(booking) => {
                        setOpenId(null);
                        setEditing(booking);
                    }}
                    key={opened.id}
                    initialExtra={openOn}
                    onClose={() => {
                        setOpenId(null);
                        setOpenOn(null);
                        // Drop ?booking= so the same link (a to-do) opens it again.
                        if (linkedId) {
                            lastLinked.current = null;
                            setView(view, { booking: null });
                        }
                    }}
                />
            )}

            {actions.cancelling && all.some((booking) => booking.id === actions.cancelling) && (
                <StaffCancelDialog
                    key={`cancel-${actions.cancelling}`}
                    booking={all.find((booking) => booking.id === actions.cancelling)}
                    onClose={actions.closeCancel}
                    onConfirm={actions.confirmCancel}
                />
            )}

            {policyOpen && policy.data && (
                <RefundPolicyDialog
                    settings={policy.data}
                    isAdmin={role === ROLES.admin}
                    onSaved={policy.reload}
                    onClose={() => {
                        setPolicyOpen(false);
                        if (params.get('policy')) setView(view, { policy: null });
                    }}
                />
            )}

            {completing && all.some((booking) => booking.id === completing) && (
                <CompleteDialog
                    booking={all.find((booking) => booking.id === completing)}
                    onClose={() => setCompleting(null)}
                    onComplete={() => baseActions.setStatus(completing, 'completed')}
                    onChanged={bookings.reload}
                />
            )}

            {editing !== undefined && (
                <BookingForm
                    booking={editing}
                    draft={editing ? undefined : draft}
                    rooms={rooms.data ?? []}
                    guests={guests.data ?? []}
                    onClose={() => setEditing(undefined)}
                    onSaved={(saved, { taken } = {}) => {
                        const created = !editing;
                        setEditing(undefined);
                        bookings.reload();
                        // A new booking opens right away: on its QR when nothing was taken (to show the guest or
                        // send the transfer content), else on its payment summary with the line just recorded.
                        if (created && saved) {
                            setOpenOn(taken ? null : 'pay');
                            setOpenId(saved.id);
                        }
                    }}
                />
            )}
        </SectionCard>
    );
};

export default BookingsManager;
