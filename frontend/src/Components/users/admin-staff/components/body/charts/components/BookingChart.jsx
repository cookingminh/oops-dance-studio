import { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAsync } from '@/hooks/useAsync';
import { bookingStatusByRoom } from '@/services/stats';
import { BOOKING_STATUSES } from '@/services/bookings';
import { monthRange } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import MonthYearSelect from '@/ui/MonthYearSelect';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const COLORS = {
    pending: '224, 221, 39',
    approved: '54, 162, 235',
    rejected: '153, 102, 255',
    cancelled: '255, 99, 132',
    completed: '75, 192, 192',
};

// Bookings per room and status for one month (any number of rooms).
const BookingChart = () => {
    const now = new Date();
    const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
    const rows = useAsync(() => bookingStatusByRoom(monthRange(period.year, period.month)), [period.year, period.month]);

    const rooms = new Map();
    for (const row of rows.data ?? []) {
        const counts = rooms.get(row.room_id) ?? { name: row.room?.name ?? `Room ${row.room_id}`, counts: {} };
        counts.counts[row.status] = (counts.counts[row.status] ?? 0) + 1;
        rooms.set(row.room_id, counts);
    }
    const roomList = [...rooms.values()];

    const chartData = {
        labels: roomList.map((room) => room.name),
        datasets: BOOKING_STATUSES.map((status) => ({
            label: status[0].toUpperCase() + status.slice(1),
            data: roomList.map((room) => room.counts[status] ?? 0),
            backgroundColor: `rgba(${COLORS[status]}, 0.6)`,
            borderColor: `rgba(${COLORS[status]}, 1)`,
            borderWidth: 1,
        })),
    };

    return (
        <div className="booking-status-chart sectionContainer flex flex-col gap-4" style={{ margin: '0 auto' }}>
            <h2 className="text-3xl font-bold">Booking Status Chart</h2>
            <MonthYearSelect month={period.month} year={period.year} onChange={setPeriod} />
            <AsyncState state={rows} isEmpty={!rows.loading && roomList.length === 0} emptyText="No bookings in this month.">
                <Bar
                    data={chartData}
                    options={{
                        responsive: true,
                        plugins: { legend: { position: 'top' }, title: { display: true, text: 'Bookings by Room and Status' } },
                        scales: {
                            x: { stacked: true },
                            y: { beginAtZero: true, stacked: true, ticks: { callback: (v) => (Number.isInteger(v) ? v : null) } },
                        },
                    }}
                />
            </AsyncState>
        </div>
    );
};

export default BookingChart;
