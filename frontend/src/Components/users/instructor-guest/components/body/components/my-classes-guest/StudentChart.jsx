import { useState } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { listMyStudentAttendance } from '@/services/attendance';
import { myStats } from '@/services/stats';
import { classImageUrl } from '@/services/storage';
import { monthRange } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import MonthYearSelect from '@/ui/MonthYearSelect';
import TableTemplate from '../../../../../../Table/TableTemplate';

ChartJS.register(ArcElement, Tooltip, Legend);

const statusOptions = [
    { uid: 'pending', name: 'pending' },
    { uid: 'absent', name: 'absent' },
    { uid: 'attend', name: 'attend' },
];

// Guest's own attendance: totals from my_stats(), a pie chart for one month, and every record.
const StudentChart = () => {
    const { user } = useAuth();
    const now = new Date();
    const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
    const records = useAsync(() => listMyStudentAttendance(user.id), [user.id]);
    const totals = useAsync(myStats, []);

    const { from, to } = monthRange(period.year, period.month);
    const inMonth = (records.data ?? []).filter((row) => row.date >= from && row.date < to);
    const attend = inMonth.filter((row) => row.status === 'attend').length;
    const absent = inMonth.filter((row) => row.status === 'absent').length;

    const chartData = {
        labels: ['Attend', 'Absent'],
        datasets: [
            {
                data: [attend, absent],
                backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
                borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="sectionContainer">
            <div className="attendance-chart flex flex-col gap-4 items-center">
                <h2 className="text-4xl font-bold">Your Attendance</h2>
                {totals.data && (
                    <p className="text-lg">
                        {totals.data.class_count} classes · {totals.data.attended_count} sessions attended · {totals.data.absent_count} missed
                    </p>
                )}

                <div className="flex flex-col lg:flex-row justify-between items-center gap-20">
                    <div className="chartDiv">
                        <MonthYearSelect month={period.month} year={period.year} onChange={setPeriod} />
                        {attend + absent > 0 ? <Pie data={chartData} /> : <p className="text-center text-gray-500">No attendance this month.</p>}
                    </div>

                    <div className="tableDiv">
                        <AsyncState state={records} isEmpty={false}>
                            <TableTemplate
                                ariaLabel="My attendance records"
                                data={(records.data ?? []).map((row) => ({
                                    id: row.id,
                                    date: row.date,
                                    class_name: row.class?.name,
                                    class_img: classImageUrl(row.class?.image_path),
                                    status: row.status,
                                    details: row.details ?? '',
                                }))}
                                columns={[
                                    { name: 'Date', uid: 'date', allowsSorting: true },
                                    { name: 'Class', uid: 'class' },
                                    { name: 'Status', uid: 'status' },
                                    { name: 'Details', uid: 'details' },
                                ]}
                                initialVisibleColumns={['date', 'class', 'status', 'details']}
                                statusOptions={statusOptions}
                            />
                        </AsyncState>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentChart;
