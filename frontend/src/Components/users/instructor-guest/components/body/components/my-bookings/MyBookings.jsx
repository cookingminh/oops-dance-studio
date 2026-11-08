import { Link } from 'react-router-dom';
import { Button } from '@nextui-org/react';
import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { cancelBooking, listMyBookings } from '@/services/bookings';
import { formatTime, formatVnd } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import TableTemplate from '../../../../../../Table/TableTemplate';
import './MyBookings.scss';

const columns = [
    { name: 'Booking ID', uid: 'id', allowsSorting: true },
    { name: 'Room', uid: 'room', allowsSorting: true },
    { name: 'Date', uid: 'date', allowsSorting: true },
    { name: 'Start', uid: 'start_time' },
    { name: 'End', uid: 'end_time' },
    { name: 'Full payment', uid: 'full_payment' },
    { name: 'Deposit', uid: 'deposit' },
    { name: 'Deposit Status', uid: 'deposit_status', allowsSorting: true },
    { name: 'Status', uid: 'status', allowsSorting: true },
    { name: 'Details', uid: 'details' },
    { name: 'Actions', uid: 'actions' },
];

const statusOptions = ['pending', 'approved', 'rejected', 'cancelled', 'completed'].map((uid) => ({ uid, name: uid }));

const MyBookings = () => {
    const { user } = useAuth();
    const toast = useToast();
    const bookings = useAsync(() => listMyBookings(user.id), [user.id]);

    const handleCancel = async (id) => {
        if (!window.confirm(`Cancel booking #${id}?`)) return;
        try {
            await cancelBooking(id);
            toast.success('Booking cancelled.');
            bookings.reload();
        } catch (error) {
            toast.error(error);
        }
    };

    const rows = (bookings.data ?? []).map((record) => ({
        id: record.id,
        room: record.room?.name,
        date: record.date,
        start_time: formatTime(record.start_time),
        end_time: formatTime(record.end_time),
        full_payment: formatVnd(record.full_payment),
        deposit: formatVnd(record.deposit),
        deposit_status: record.deposit_status,
        status: record.status,
        details: record.details ?? '',
        // Only pending bookings can be cancelled by their owner.
        actions: record.status === 'pending' ? (
            <Button size="sm" color="danger" variant="flat" onPress={() => handleCancel(record.id)}>
                Cancel
            </Button>
        ) : null,
    }));
    const awaitingDeposit = rows.filter((row) => row.deposit_status === 'waiting' && ['pending', 'approved'].includes(row.status));

    return (
        <div className="myBookings">
            {awaitingDeposit.length > 0 && (
                <div className="listing sectionContainer flex">
                    <div className="header">
                        <h1 className="font-bold text-3xl">Awaiting Deposit</h1>
                    </div>
                    <TableTemplate
                        ariaLabel="Bookings awaiting a deposit"
                        columns={columns}
                        data={awaitingDeposit}
                        statusOptions={statusOptions}
                        initialVisibleColumns={['id', 'room', 'date', 'start_time', 'end_time', 'deposit', 'status', 'actions']}
                    />
                </div>
            )}

            <div className="listing sectionContainer flex">
                <div className="header flex justify-between items-center">
                    <h1 className="font-bold text-3xl">All Bookings</h1>
                    <Link to="/home" className="btn">Book a room</Link>
                </div>
                <AsyncState state={bookings} emptyText="You have no bookings yet.">
                    <TableTemplate
                        ariaLabel="All my bookings"
                        columns={columns}
                        data={rows}
                        statusOptions={statusOptions}
                        initialVisibleColumns={columns.map((col) => col.uid)}
                    />
                </AsyncState>
            </div>
        </div>
    );
};

export default MyBookings;
