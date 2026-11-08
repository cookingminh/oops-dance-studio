import './bookingsManager.scss'
import BookingList from './components/booking-list/BookingList'

const Bookings = () => {
    return (
        <div className='adminBookings'>
            <BookingList />
        </div>
    )
}

export default Bookings