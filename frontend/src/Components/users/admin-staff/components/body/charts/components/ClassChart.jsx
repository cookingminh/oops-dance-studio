import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useAsync } from '@/hooks/useAsync';
import { classEnrolment } from '@/services/stats';
import AsyncState from '@/ui/feedback/AsyncState';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Current number of enrolled students per class.
const ClassChart = () => {
    const classes = useAsync(classEnrolment, []);
    const list = classes.data ?? [];

    const chartData = {
        labels: list.map((item) => item.name),
        datasets: [
            {
                label: 'Number of Students',
                data: list.map((item) => item.students),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="class-chart sectionContainer flex flex-col gap-4">
            <h2 className="text-3xl font-bold">Class Enrollment</h2>
            <AsyncState state={classes} emptyText="No classes yet.">
                <div style={{ height: '500px' }}>
                    <Bar
                        data={chartData}
                        options={{
                            scales: { y: { beginAtZero: true, ticks: { callback: (v) => (Number.isInteger(v) ? v : null) } } },
                            responsive: true,
                            maintainAspectRatio: false,
                        }}
                    />
                </div>
            </AsyncState>
        </div>
    );
};

export default ClassChart;
