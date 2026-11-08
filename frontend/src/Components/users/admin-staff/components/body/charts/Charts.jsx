import BookingChart from './components/BookingChart';
import ClassChart from './components/ClassChart';
import RevenueChart from './components/RevenueChart';

const Charts = () => (
    <div className="flex flex-col gap-4">
        <RevenueChart />
        <BookingChart />
        <ClassChart />
    </div>
);

export default Charts;
