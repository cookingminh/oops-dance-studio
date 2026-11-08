import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { LuTicket } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { bookingStatusByRoom } from '@/services/stats';
import { monthRange } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import MonthYearSelect from '@/ui/MonthYearSelect';
import SectionCard from '../../../common/SectionCard';
import { STATUS_COLORS, STATUS_STACK_ORDER, barDataset, barOptions } from '../../../common/chartTheme';
import { ChartTable, ViewToggle } from '../../../common/ChartViews';

const label = (status) => status[0].toUpperCase() + status.slice(1);

// Bookings per room and status for one month (any number of rooms).
const BookingChart = () => {
    const now = new Date();
    const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
    const [view, setView] = useState('chart');
    const rows = useAsync(() => bookingStatusByRoom(monthRange(period.year, period.month)), [period.year, period.month]);

    const rooms = new Map();
    for (const row of rows.data ?? []) {
        const room = rooms.get(row.room_id) ?? { name: row.room?.name ?? `Room ${row.room_id}`, counts: {} };
        room.counts[row.status] = (room.counts[row.status] ?? 0) + 1;
        rooms.set(row.room_id, room);
    }
    const roomList = [...rooms.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true })).map(([, room]) => room);

    const chartData = {
        labels: roomList.map((room) => room.name),
        datasets: STATUS_STACK_ORDER.map((status) =>
            barDataset(label(status), roomList.map((room) => room.counts[status] ?? 0), STATUS_COLORS[status], { stacked: true })
        ),
    };
    const total = (rows.data ?? []).length;

    return (
        <SectionCard
            className="chartCard"
            icon={LuTicket}
            title="Booking status"
            subtitle={`${total} booking${total === 1 ? '' : 's'} by room and status`}
            actions={
                <>
                    <MonthYearSelect month={period.month} year={period.year} onChange={setPeriod} className="monthYearSelect" selectClassName="" />
                    <ViewToggle view={view} onChange={setView} label="Booking status" />
                </>
            }
        >
            <AsyncState state={rows} isEmpty={!rows.loading && roomList.length === 0} emptyText="No bookings in this month.">
                {view === 'table' ? (
                    <ChartTable data={chartData} rowHeader="Room" />
                ) : (
                    <div className="chartCanvas">
                        <Bar data={chartData} options={barOptions({ stacked: true })} />
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default BookingChart;
