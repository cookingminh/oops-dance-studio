import { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { LuBarChart3 } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listInstructorAttendance } from '@/services/attendance';
import { monthRange } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import MonthYearSelect from '@/ui/MonthYearSelect';
import SectionCard from '../../../common/SectionCard';
import { STATUS_COLORS, barDataset, barOptions } from '../../../common/chartTheme';
import { ChartTable, ViewToggle } from '../../../common/ChartViews';

// Completed vs cancelled sessions per instructor for one month.
const AttendanceChart = () => {
    const now = new Date();
    const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
    const [view, setView] = useState('chart');
    const records = useAsync(() => listInstructorAttendance(monthRange(period.year, period.month)), [period.year, period.month]);

    const byInstructor = new Map();
    for (const row of records.data ?? []) {
        const name = row.instructor?.full_name || row.instructor?.username || 'Unknown';
        const counts = byInstructor.get(row.instructor_id) ?? { name, completed: 0, cancelled: 0 };
        if (row.status === 'completed') counts.completed += 1;
        if (row.status === 'cancelled') counts.cancelled += 1;
        byInstructor.set(row.instructor_id, counts);
    }
    const series = [...byInstructor.values()].sort((a, b) => a.name.localeCompare(b.name));

    const chartData = {
        labels: series.map((s) => s.name),
        datasets: [
            barDataset('Completed', series.map((s) => s.completed), STATUS_COLORS.completed),
            barDataset('Cancelled', series.map((s) => s.cancelled), STATUS_COLORS.cancelled),
        ],
    };

    return (
        <SectionCard
            icon={LuBarChart3}
            title="Sessions per instructor"
            subtitle="Completed and cancelled sessions in the selected month"
            actions={
                <>
                    <MonthYearSelect month={period.month} year={period.year} onChange={setPeriod} className="monthYearSelect" selectClassName="" />
                    <ViewToggle view={view} onChange={setView} label="Sessions per instructor" />
                </>
            }
        >
            <AsyncState state={records} isEmpty={!records.loading && series.length === 0} emptyText="No sessions in this month.">
                {view === 'table' ? (
                    <ChartTable data={chartData} rowHeader="Instructor" />
                ) : (
                    <div className="chartCanvas">
                        <Bar data={chartData} options={barOptions()} />
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default AttendanceChart;
