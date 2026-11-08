import { useState } from 'react';
import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Input,
    Pagination,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tooltip,
    User,
} from '@nextui-org/react';
import { LuCheck, LuPlus, LuSearch, LuStickyNote, LuTicket, LuX } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { cancelBooking, deleteBooking, listBookings, updateBooking } from '@/services/bookings';
import { listRooms } from '@/services/rooms';
import { listGuests } from '@/services/users';
import { getStudioToday } from '@/services/studio';
import { avatarUrl } from '@/services/storage';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { VerticalDotsIcon } from '../../../../../../../Table/VerticalDotsIcon';
import { statusColorMap } from '../../../../../../../Table/utils';
import SectionCard from '../../../../common/SectionCard';
import { SERIES, STATUS_COLORS } from '../../../../common/chartTheme';
import Segmented from '../../../../common/Segmented';
import StatusSelect from '../../../../common/StatusSelect';
import { useStaffTasks } from '../../../../../tasks/staffTasks';
import BookingForm from './BookingForm';

const PAGE_SIZE = 10;

const SCOPES = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All dates' },
];

const STATUS_FILTERS = ['all', 'pending', 'approved', 'completed', 'rejected', 'cancelled'];

const QUICK_ACTIONS = {
    pending: [['approved', 'Approve'], ['rejected', 'Reject']],
    approved: [['completed', 'Mark completed'], ['cancelled', 'Cancel']],
};

const DEPOSIT_LABELS = { waiting: 'waiting', completed: 'paid', cancelled: 'cancelled' };

const COLUMNS = [
    { key: 'id', label: 'Booking' },
    { key: 'guest', label: 'Guest' },
    { key: 'room', label: 'Room' },
    { key: 'when', label: 'When' },
    { key: 'payment', label: 'Payment' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
];

const capitalize = (text) => text[0].toUpperCase() + text.slice(1);
const byRoomId = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
const soonestFirst = (a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);

function countBy(list, keyOf) {
    const counts = new Map();
    for (const item of list) counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1);
    return counts;
}

// Every booking, filtered by room, time (upcoming / past) and status, with search.
// Pending requests can be approved or rejected right from their row; the ⋮ menu has the rest.
// Row actions sit in fixed slots (note · reject + approve · menu) so they line up down the table.
const BookingList = () => {
    const toast = useToast();
    const { refresh: refreshTasks } = useStaffTasks();
    const bookings = useAsync(listBookings, []);
    const rooms = useAsync(listRooms, []);
    const guests = useAsync(listGuests, []);
    const today = useAsync(getStudioToday, []);

    const [roomFilter, setRoomFilter] = useState('all');
    const [scope, setScope] = useState('upcoming');
    const [statusFilter, setStatusFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [busyId, setBusyId] = useState(null);
    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, row = edit

    // Any filter change starts again from the first page.
    const filterSetter = (setter) => (value) => {
        setter(value);
        setPage(1);
    };

    const roomList = [...(rooms.data ?? [])].sort(byRoomId);
    const roomColor = new Map(roomList.map((room, index) => [room.id, SERIES[index % SERIES.length]]));

    // Scope and search apply everywhere; each facet's counts include the other facet's choice.
    const term = query.trim().toLowerCase();
    const todayIso = today.data;
    const base = (bookings.data ?? []).filter((booking) => {
        if (todayIso && scope === 'upcoming' && booking.date < todayIso) return false;
        if (todayIso && scope === 'past' && booking.date >= todayIso) return false;
        if (!term) return true;
        return [booking.guest?.full_name, booking.guest?.username, booking.guest?.email, booking.room?.name, booking.date, `#${booking.id}`, booking.details]
            .some((value) => String(value ?? '').toLowerCase().includes(term));
    });
    const roomMatches = (booking) => roomFilter === 'all' || String(booking.room_id) === roomFilter;
    const statusMatches = (booking) => statusFilter === 'all' || booking.status === statusFilter;

    const roomCounts = countBy(base.filter(statusMatches), (booking) => String(booking.room_id));
    const statusCounts = countBy(base.filter(roomMatches), (booking) => booking.status);
    const visible = base.filter(roomMatches).filter(statusMatches);
    visible.sort(scope === 'upcoming' ? soonestFirst : (a, b) => soonestFirst(b, a));

    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const roomOptions = [
        { key: 'all', label: 'All rooms', count: [...roomCounts.values()].reduce((sum, n) => sum + n, 0) },
        ...roomList.map((room) => ({ key: String(room.id), label: room.name, count: roomCounts.get(String(room.id)) ?? 0, color: roomColor.get(room.id) })),
    ];
    const statusOptions = STATUS_FILTERS.map((status) => ({
        key: status,
        label: status === 'all' ? 'Any status' : capitalize(status),
        count: status === 'all' ? base.filter(roomMatches).length : statusCounts.get(status) ?? 0,
        color: STATUS_COLORS[status],
    }));

    const roomName = roomFilter === 'all' ? 'all rooms' : roomList.find((room) => String(room.id) === roomFilter)?.name;
    const scopeWord = { upcoming: 'upcoming', past: 'past', all: '' }[scope];
    const statusWord = statusFilter === 'all' ? '' : `${statusFilter} `;
    const summary = bookings.data
        ? `${visible.length} ${scopeWord ? `${scopeWord} ` : ''}${statusWord}booking${visible.length === 1 ? '' : 's'} in ${roomName}`
        : 'Loading bookings…';

    const setStatus = async (id, status) => {
        setBusyId(id);
        try {
            if (status === 'cancelled') await cancelBooking(id);
            else await updateBooking(id, { status });
            toast.success(`Booking #${id} is now ${status}.`);
            bookings.reload();
            refreshTasks();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`Delete booking #${id}? This can’t be undone.`)) return;
        try {
            await deleteBooking(id);
            toast.success('Booking deleted.');
            bookings.reload();
            refreshTasks();
        } catch (error) {
            toast.error(error);
        }
    };

    const clearFilters = () => {
        setRoomFilter('all');
        setStatusFilter('all');
        setScope('all');
        setQuery('');
        setPage(1);
    };

    const renderCell = (booking, key) => {
        switch (key) {
            case 'id':
                return <span className="bookingId">#{booking.id}</span>;
            case 'guest': {
                const name = booking.guest?.full_name || booking.guest?.username || 'Guest';
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, radius: 'full', size: 'sm', src: avatarUrl(booking.guest?.avatar_path, booking.guest?.updated_at) ?? undefined, name }}
                        name={name}
                        description={booking.guest?.email}
                    />
                );
            }
            case 'room':
                return (
                    <span className="roomPill">
                        <span className="segDot" style={{ background: roomColor.get(booking.room_id) }} aria-hidden="true" />
                        {booking.room?.name}
                    </span>
                );
            case 'when': {
                const date = parseISO(booking.date);
                const sameYear = booking.date.slice(0, 4) === (todayIso ?? '').slice(0, 4);
                return (
                    <div className="stackCell">
                        <strong>
                            {format(date, sameYear ? 'EEE d MMM' : 'EEE d MMM yyyy')}
                            {booking.date === todayIso && <span className="todayTag">Today</span>}
                        </strong>
                        <span>{formatTimeRange(booking.start_time, booking.end_time)}</span>
                    </div>
                );
            }
            case 'payment':
                return (
                    <div className="stackCell">
                        <strong>{formatVnd(booking.full_payment)}</strong>
                        <span>
                            Deposit {formatVnd(booking.deposit)} ·{' '}
                            <span className={`depositState is-${booking.deposit_status}`}>{DEPOSIT_LABELS[booking.deposit_status] ?? booking.deposit_status}</span>
                        </span>
                    </div>
                );
            case 'status':
                return (
                    <Chip className="capitalize" color={statusColorMap[booking.status] ?? 'default'} size="sm" variant="flat">
                        {booking.status}
                    </Chip>
                );
            case 'actions':
                return (
                    <div className="rowActions">
                        {!booking.details && <span className="actionSlot" aria-hidden="true" />}
                        {booking.details && (
                            <Tooltip content={<span className="noteTooltip">{booking.details}</span>}>
                                <Button isIconOnly size="sm" variant="light" aria-label={`Note for booking ${booking.id}`}>
                                    <LuStickyNote className="text-default-500" />
                                </Button>
                            </Tooltip>
                        )}
                        {booking.status !== 'pending' && <span className="actionSlot isDouble" aria-hidden="true" />}
                        {booking.status === 'pending' && (
                            <>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    aria-label={`Reject booking ${booking.id}`}
                                    isDisabled={busyId === booking.id}
                                    onPress={() => setStatus(booking.id, 'rejected')}
                                >
                                    <LuX />
                                </Button>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    color="success"
                                    className="text-white"
                                    aria-label={`Approve booking ${booking.id}`}
                                    isLoading={busyId === booking.id}
                                    onPress={() => setStatus(booking.id, 'approved')}
                                >
                                    <LuCheck />
                                </Button>
                            </>
                        )}
                        <Dropdown>
                            <DropdownTrigger>
                                <Button isIconOnly size="sm" variant="light" aria-label={`Actions for booking ${booking.id}`}>
                                    <VerticalDotsIcon className="text-default-400" />
                                </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Booking actions">
                                {[
                                    ...(QUICK_ACTIONS[booking.status] ?? []).map(([status, label]) => (
                                        <DropdownItem key={status} onPress={() => setStatus(booking.id, status)}>{label}</DropdownItem>
                                    )),
                                    <DropdownItem key="edit" onPress={() => setEditing(booking)}>Edit booking & payments</DropdownItem>,
                                    <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => handleDelete(booking.id)}>
                                        Delete booking
                                    </DropdownItem>,
                                ]}
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                );
            default:
                return null;
        }
    };

    const from = visible.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(currentPage * PAGE_SIZE, visible.length);

    return (
        <SectionCard
            className="bookingsCard"
            icon={LuTicket}
            title="Bookings"
            subtitle={summary}
            actions={
                <>
                    <Input
                        isClearable
                        aria-label="Search bookings"
                        placeholder="Search..."
                        className="bookingSearch"
                        startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                        value={query}
                        onValueChange={filterSetter(setQuery)}
                        onClear={() => filterSetter(setQuery)('')}
                    />
                    <Button color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={() => setEditing(null)}>
                        New booking
                    </Button>
                </>
            }
        >
            <div className="bookingToolbar">
                <Segmented label="Room" options={roomOptions} value={roomFilter} onChange={filterSetter(setRoomFilter)} className="isRooms" />
                <div className="toolbarGroup">
                    <StatusSelect options={statusOptions} value={statusFilter} onChange={filterSetter(setStatusFilter)} />
                    <Segmented label="Dates" options={SCOPES} value={scope} onChange={filterSetter(setScope)} />
                </div>
            </div>

            <AsyncState state={bookings} isEmpty={false}>
                <div className="tableScroll">
                    <Table aria-label="Bookings" removeWrapper className="bookingTable">
                        <TableHeader columns={COLUMNS}>
                            {(column) => (
                                <TableColumn key={column.key} align={column.key === 'actions' ? 'end' : 'start'}>
                                    {column.label}
                                </TableColumn>
                            )}
                        </TableHeader>
                        <TableBody
                            items={pageRows}
                            emptyContent={
                                <div className="tableEmpty">
                                    <span>No bookings match these filters.</span>
                                    <Button size="sm" variant="flat" onPress={clearFilters}>Show every booking</Button>
                                </div>
                            }
                        >
                            {(booking) => (
                                <TableRow key={booking.id}>
                                    {(key) => <TableCell>{renderCell(booking, key)}</TableCell>}
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {visible.length > 0 && (
                    <div className="tableFooter">
                        <span>
                            {from}–{to} of {visible.length}
                        </span>
                        {pages > 1 && <Pagination isCompact showControls color="danger" page={currentPage} total={pages} onChange={setPage} />}
                    </div>
                )}
            </AsyncState>

            {editing !== undefined && (
                <BookingForm
                    booking={editing}
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

export default BookingList;
