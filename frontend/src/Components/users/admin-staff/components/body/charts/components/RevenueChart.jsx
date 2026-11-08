import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { format, parseISO } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { revenueMonthly } from '@/services/stats';
import { formatVnd } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PALETTE = ['54, 162, 235', '255, 159, 64', '75, 192, 192', '153, 102, 255', '255, 99, 132'];

// Real income per month, stacked by room (approved + completed bookings, from v_revenue_monthly).
const RevenueChart = () => {
    const revenue = useAsync(revenueMonthly, []);
    const rows = revenue.data ?? [];

    const months = [...new Set(rows.map((row) => row.month))].sort();
    const rooms = [...new Map(rows.map((row) => [row.room_id, row.room_name])).entries()];
    const chartData = {
        labels: months.map((month) => format(parseISO(month), 'MM/yyyy')),
        datasets: rooms.map(([roomId, roomName], index) => ({
            label: roomName,
            data: months.map((month) => {
                const row = rows.find((r) => r.month === month && r.room_id === roomId);
                return row ? Number(row.real_income_sum ?? 0) : 0;
            }),
            backgroundColor: `rgba(${PALETTE[index % PALETTE.length]}, 0.6)`,
            borderColor: `rgba(${PALETTE[index % PALETTE.length]}, 1)`,
            borderWidth: 1,
        })),
    };

    return (
        <div className="sectionContainer flex flex-col gap-4">
            <h2 className="text-3xl font-bold">Monthly Revenue</h2>
            <AsyncState state={revenue} emptyText="No approved or completed bookings yet.">
                <Bar
                    data={chartData}
                    options={{
                        responsive: true,
                        plugins: {
                            title: { display: true, text: 'Real income by room (VND)' },
                            tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatVnd(ctx.parsed.y)}` } },
                        },
                        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: (v) => formatVnd(v) } } },
                    }}
                />
            </AsyncState>
        </div>
    );
};

export default RevenueChart;
