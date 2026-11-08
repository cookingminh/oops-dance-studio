import BookingChart from './components/BookingChart';
import ClassChart from './components/ClassChart';
import RevenueChart from './components/RevenueChart';

// Revenue across the top; bookings and enrolment side by side below.
const Charts = () => (
    <div className="chartsGrid">
        <RevenueChart />
        <BookingChart />
        <ClassChart />
    </div>
);

export default Charts;
