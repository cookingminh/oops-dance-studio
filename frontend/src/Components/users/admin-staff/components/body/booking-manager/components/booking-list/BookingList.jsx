import { useState } from 'react';
import { Dropdown, DropdownItem, DropdownTrigger, Button, DropdownMenu } from '@nextui-org/react';
import { useAsync } from '@/hooks/useAsync';
import { cancelBooking, deleteBooking, listBookings, updateBooking } from '@/services/bookings';
import { listRooms } from '@/services/rooms';
import { listGuests } from '@/services/users';
import { avatarUrl } from '@/services/storage';
import { formatTime, formatVnd } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { VerticalDotsIcon } from '../../../../../../../Table/VerticalDotsIcon';
import TableTemplate from '../../../../../../../Table/TableTemplate';
import BookingForm from './BookingForm';

const columns = [
    { name: 'Booking ID', uid: 'id', allowsSorting: true },
    { name: 'Guest', uid: 'guest' },
    { name: 'Room', uid: 'room', allowsSorting: true },
    { name: 'Date', uid: 'date', allowsSorting: true },
    { name: 'Start', uid: 'start_time', allowsSorting: true },
    { name: 'End', uid: 'end_time' },
    { name: 'Full payment', uid: 'full_payment' },
    { name: 'Deposit', uid: 'deposit' },
    { name: 'Deposit Status', uid: 'deposit_status', allowsSorting: true },
    { name: 'Bank Transfer', uid: 'bank_transfer' },
    { name: 'Cash', uid: 'cash' },
    { name: 'Real income', uid: 'real_income' },
    { name: 'Status', uid: 'status', allowsSorting: true },
    { name: 'Details', uid: 'details' },
    { name: 'Actions', uid: 'actions' },
];

const INITIAL_VISIBLE_COLUMNS = ['id', 'guest', 'room', 'date', 'start_time', 'end_time', 'deposit', 'deposit_status', 'status', 'details', 'actions'];

const statusOptions = [
    { uid: 'pending', name: 'pending' },
    { uid: 'approved', name: 'approved' },
    { uid: 'rejected', name: 'rejected' },
    { uid: 'cancelled', name: 'cancelled' },
    { uid: 'completed', name: 'completed' },
];

const QUICK_ACTIONS = {
    pending: [['approved', 'Approve'], ['rejected', 'Reject']],
    approved: [['completed', 'Mark completed'], ['cancelled', 'Cancel']],
};

const BookingList = () => {
    const toast = useToast();
    const bookings = useAsync(listBookings, []);
    const rooms = useAsync(listRooms, []);
    const guests = useAsync(listGuests, []);
    const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, row = edit

    const rows = (bookings.data ?? []).map((record) => ({
        id: record.id,
        record,
        guest_avatar: avatarUrl(record.guest?.avatar_path, record.guest?.updated_at),
        guest_email: record.guest?.email,
        guest_username: record.guest?.full_name || record.guest?.username,
        room: record.room?.name,
        date: record.date,
        start_time: formatTime(record.start_time),
        end_time: formatTime(record.end_time),
        full_payment: formatVnd(record.full_payment),
        deposit: formatVnd(record.deposit),
        deposit_status: record.deposit_status,
        bank_transfer: formatVnd(record.bank_transfer),
        cash: formatVnd(record.cash),
        real_income: formatVnd(record.real_income),
        status: record.status,
        details: record.details,
    }));

    const setStatus = async (id, status) => {
        try {
            if (status === 'cancelled') await cancelBooking(id);
            else await updateBooking(id, { status });
            toast.success(`Booking #${id} is now ${status}.`);
            bookings.reload();
        } catch (error) {
            toast.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(`Delete booking #${id}? This can’t be undone.`)) return;
        try {
            await deleteBooking(id);
            toast.success('Booking deleted.');
            bookings.reload();
        } catch (error) {
            toast.error(error);
        }
    };

    const renderActions = (item) => (
        <Dropdown>
            <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light" aria-label={`Actions for booking ${item.id}`}>
                    <VerticalDotsIcon className="text-default-300" />
                </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Booking actions">
                {[
                    ...(QUICK_ACTIONS[item.status] ?? []).map(([status, label]) => (
                        <DropdownItem key={status} onPress={() => setStatus(item.id, status)}>{label}</DropdownItem>
                    )),
                    <DropdownItem key="edit" onPress={() => setEditing(item.record)}>Edit booking & payments</DropdownItem>,
                    <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => handleDelete(item.id)}>
                        Delete booking
                    </DropdownItem>,
                ]}
            </DropdownMenu>
        </Dropdown>
    );

    return (
        <div className="sectionContainer">
            <div className="header">
                <h2>Booking List</h2>
            </div>
            <AsyncState state={bookings} isEmpty={false}>
                <TableTemplate
                    ariaLabel="Bookings"
                    columns={columns}
                    data={rows}
                    statusOptions={statusOptions}
                    initialVisibleColumns={INITIAL_VISIBLE_COLUMNS}
                    renderActions={renderActions}
                    onAddNew={() => setEditing(null)}
                />
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
        </div>
    );
};

export default BookingList;
