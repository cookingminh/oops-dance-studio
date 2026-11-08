import { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAsync } from '@/hooks/useAsync';
import { listInstructorAttendance } from '@/services/attendance';
import { monthRange } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import MonthYearSelect from '@/ui/MonthYearSelect';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const integerTicks = { callback: (value) => (Number.isInteger(value) ? value : null) };

// Completed vs cancelled sessions per instructor for one month.
const AttendanceChart = () => {
    const now = new Date();
    const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
    const records = useAsync(() => listInstructorAttendance(monthRange(period.year, period.month)), [period.year, period.month]);

    const byInstructor = new Map();
    for (const row of records.data ?? []) {
        const name = row.instructor?.full_name || row.instructor?.username || 'Unknown';
        const counts = byInstructor.get(row.instructor_id) ?? { name, completed: 0, cancelled: 0 };
        if (row.status === 'completed') counts.completed += 1;
        if (row.status === 'cancelled') counts.cancelled += 1;
        byInstructor.set(row.instructor_id, counts);
    }
    const series = [...byInstructor.values()];

    const chartData = {
        labels: series.map((s) => s.name),
        datasets: [
            { label: 'Completed', data: series.map((s) => s.completed), backgroundColor: 'rgba(75, 192, 192, 0.6)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 },
            { label: 'Cancelled', data: series.map((s) => s.cancelled), backgroundColor: 'rgba(255, 99, 132, 0.6)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 },
        ],
    };

    return (
        <div className="attendance-chart sectionContainer flex flex-col gap-4">
            <h2 className="text-3xl font-bold">Instructor Attendance Chart</h2>
            <MonthYearSelect month={period.month} year={period.year} onChange={setPeriod} />
            <AsyncState state={records} isEmpty={!records.loading && series.length === 0} emptyText="No sessions in this month.">
                <Bar data={chartData} options={{ scales: { y: { beginAtZero: true, ticks: integerTicks } } }} />
            </AsyncState>
        </div>
    );
};

export default AttendanceChart;
