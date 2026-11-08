import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseISO } from 'date-fns';
import { RxCalendar } from 'react-icons/rx';
import { FiClock } from 'react-icons/fi';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { IoIosCloseCircle } from 'react-icons/io';
import Aos from 'aos';
import 'aos/dist/aos.css';
import { useAuth } from '@/auth/useAuth';
import { DASHBOARD_ROLES } from '@/auth/roles';
import { useAsync } from '@/hooks/useAsync';
import { listRooms } from '@/services/rooms';
import { createBooking, getAvailableSlots } from '@/services/bookings';
import { getStudioToday } from '@/services/studio';
import { useToast } from '@/ui/feedback/toastContext';
import { TIME_OPTIONS, formatTime, formatVnd, toIsoDate, toMinutes } from '@/lib/format';

const ALL_ROOMS = 'all';

// A requested range is bookable if one free window fully contains it.
const fits = (windows, start, end) =>
    windows.some((w) => toMinutes(formatTime(w.start_time)) <= toMinutes(start) && toMinutes(end) <= toMinutes(formatTime(w.end_time)));

const Search = () => {
    const { user, isAuthenticated } = useAuth();
    const toast = useToast();
    const rooms = useAsync(listRooms, []);
    const [today, setToday] = useState(() => new Date());
    const [date, setDate] = useState(() => new Date());
    const [selectedRoom, setSelectedRoom] = useState(ALL_ROOMS);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [slots, setSlots] = useState(null); // { [roomId]: windows[] } for the searched date
    const [searchedDate, setSearchedDate] = useState(null);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [bookingRoom, setBookingRoom] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmed, setConfirmed] = useState(null);

    useEffect(() => {
        Aos.init({ duration: 2000 });
        // The studio's "today" (Asia/Ho_Chi_Minh), not the visitor's clock.
        getStudioToday()
            .then((iso) => {
                const studioToday = parseISO(iso);
                setToday(studioToday);
                setDate((current) => (current < studioToday ? studioToday : current));
            })
            .catch(() => {});
    }, []);

    const timeError = startTime && endTime && toMinutes(startTime) >= toMinutes(endTime)
        ? 'Check-in time must be before check-out time.'
        : '';

    const clearResults = () => {
        setSlots(null);
        setSearchError('');
    };

    const handleSearch = async () => {
        if (timeError) return;
        const isoDate = toIsoDate(date);
        setSearching(true);
        setSearchError('');
        try {
            const rows = await getAvailableSlots(isoDate);
            const grouped = {};
            for (const row of rows) (grouped[row.room_id] ??= []).push(row);
            setSlots(grouped);
            setSearchedDate(isoDate);
        } catch (error) {
            setSlots(null);
            setSearchError(error.message);
        } finally {
            setSearching(false);
        }
    };

    const visibleRooms = useMemo(
        () => (rooms.data ?? []).filter((room) => selectedRoom === ALL_ROOMS || room.id === selectedRoom),
        [rooms.data, selectedRoom]
    );

    const estimate = useMemo(() => {
        if (!bookingRoom || !startTime || !endTime) return null;
        const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60;
        const total = hours * Number(bookingRoom.price);
        return { hours, total, deposit: total / 2 };
    }, [bookingRoom, startTime, endTime]);

    const handleConfirm = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            const booking = await createBooking({ roomId: bookingRoom.id, date: searchedDate, startTime, endTime });
            setConfirmed({ booking, room: bookingRoom });
            setBookingRoom(null);
            clearResults();
        } catch (error) {
            toast.error(error);
            if (error.code === 'SLOT_TAKEN') {
                setBookingRoom(null);
                handleSearch();
            }
        } finally {
            setSubmitting(false);
        }
    };

    const myBookingsPath = DASHBOARD_ROLES.includes(user?.role) ? '/admin/bookings' : '/profile/my-bookings';
    const overlayOpen = Boolean(bookingRoom || confirmed);

    return (
        <div className="search container section">
            <div data-aos="fade-up" data-aos-duration="2500" className="sectionContainer flex">
                <div className="guide icon" title="Pick a room, a date and a time range, then search.">
                    <FaRegQuestionCircle />
                </div>
                <div className="btns flex">
                    {(rooms.data ?? []).map((room) => (
                        <button
                            type="button"
                            key={room.id}
                            className={`singleBtn ${selectedRoom === room.id ? 'active' : ''}`}
                            onClick={() => setSelectedRoom(room.id)}
                        >
                            <span>{room.name}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        className={`singleBtn ${selectedRoom === ALL_ROOMS ? 'active' : ''}`}
                        onClick={() => setSelectedRoom(ALL_ROOMS)}
                    >
                        <span>All Rooms</span>
                    </button>
                </div>

                <div data-aos="fade-up" data-aos-duration="2000" className="searchInputs grid">
                    <div className="singleInput flex">
                        <div className="iconDiv flex items-center">
                            <RxCalendar className="icon" />
                        </div>
                        <div className="texts">
                            <h4>Select Date</h4>
                            <DatePicker
                                selected={date}
                                onChange={(value) => {
                                    if (value) setDate(value);
                                    clearResults();
                                }}
                                minDate={today}
                                dateFormat="dd/MM/yyyy"
                                placeholderText="Choose a date"
                            />
                        </div>
                    </div>
                    <div className="singleInput flex">
                        <div className="iconDiv flex items-center">
                            <FiClock className="icon" />
                        </div>
                        <div className="texts">
                            <h4>Check In</h4>
                            <select
                                aria-label="Check-in time"
                                value={startTime}
                                onChange={(event) => {
                                    setStartTime(event.target.value);
                                    clearResults();
                                }}
                            >
                                <option value="">Select Time</option>
                                {TIME_OPTIONS.slice(0, -1).map((time) => (
                                    <option key={time} value={time}>{time}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="singleInput flex">
                        <div className="iconDiv flex items-center">
                            <FiClock className="icon" />
                        </div>
                        <div className="texts">
                            <h4>Check Out</h4>
                            <select
                                aria-label="Check-out time"
                                value={endTime}
                                onChange={(event) => {
                                    setEndTime(event.target.value);
                                    clearResults();
                                }}
                            >
                                <option value="">Select Time</option>
                                {TIME_OPTIONS.slice(1).map((time) => (
                                    <option key={time} value={time}>{time}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    data-aos="fade-up"
                    data-aos-duration="2500"
                    className="btn"
                    onClick={handleSearch}
                    disabled={searching || Boolean(timeError)}
                >
                    {searching ? 'Searching…' : 'Search Room'}
                </button>

                {(timeError || searchError || rooms.error) && (
                    <div className="error-message" role="alert">
                        {timeError || searchError || rooms.error.message}
                    </div>
                )}

                <div className={`searchResult ${slots ? 'visible' : 'hidden'}`}>
                    {slots && visibleRooms.map((room) => {
                        const windows = slots[room.id] ?? [];
                        const hasRange = startTime && endTime;
                        return (
                            <div key={room.id}>
                                <h2>{room.name}:</h2>
                                {hasRange ? (
                                    fits(windows, startTime, endTime) ? (
                                        <>
                                            <p>{room.name} is available from {startTime} to {endTime}</p>
                                            <button type="button" className="btn" onClick={() => setBookingRoom(room)}>
                                                Book Now
                                            </button>
                                        </>
                                    ) : (
                                        <p>{room.name} is not available from {startTime} to {endTime}</p>
                                    )
                                ) : windows.length > 0 ? (
                                    windows.map((w) => (
                                        <p key={w.start_time}>{formatTime(w.start_time)} - {formatTime(w.end_time)}</p>
                                    ))
                                ) : (
                                    <p>Fully booked on this day.</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* BOOKING FORM */}
            <div className={bookingRoom ? 'formDiv showForm' : 'formDiv'}>
                {bookingRoom && (isAuthenticated ? (
                    <form className="form flex" onSubmit={handleConfirm}>
                        <IoIosCloseCircle className="icon" role="button" aria-label="Close" onClick={() => setBookingRoom(null)} />
                        <div className="guestInfo flex">
                            <h2>Please check your booking’s information below</h2>
                            <div className="bookingInfo flex">
                                <h2>Your Booking</h2>
                                <p>Guest: {user?.full_name || user?.username || user?.email}</p>
                                <p>Room: {bookingRoom.name}</p>
                                <p>Date: {date.toDateString()}</p>
                                <p>Check In: {startTime}</p>
                                <p>Check Out: {endTime}</p>
                                {estimate && (
                                    <>
                                        <p>Estimated total: {formatVnd(estimate.total)} ({estimate.hours} h × {formatVnd(bookingRoom.price)})</p>
                                        <p>Deposit (50%): {formatVnd(estimate.deposit)}</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <button type="submit" className="btn" disabled={submitting}>
                            <span>{submitting ? 'Booking…' : 'Confirm'}</span>
                        </button>
                    </form>
                ) : (
                    <div className="form flex">
                        <IoIosCloseCircle className="icon" role="button" aria-label="Close" onClick={() => setBookingRoom(null)} />
                        <div className="guestInfo flex">
                            <div className="bookingInfo flex">
                                <h2>Please log in to book a room</h2>
                                <p>Log in or create an account, then search again to book this slot.</p>
                            </div>
                        </div>
                        <Link to="/login" state={{ from: { pathname: '/home' } }} className="btn">
                            Log in
                        </Link>
                        <Link to="/register">No account yet? Sign up</Link>
                    </div>
                ))}
            </div>

            <div className={overlayOpen ? 'blurLayer showLayer' : 'blurLayer'}></div>

            {confirmed && (
                <div className="confirmation flex flex-col justify-center items-center" role="status">
                    <IoIosCloseCircle className="icon" role="button" aria-label="Close" onClick={() => setConfirmed(null)} />
                    <h2>Booking request sent!</h2>
                    <p>
                        {confirmed.room.name}, {confirmed.booking.date}, {formatTime(confirmed.booking.start_time)}–
                        {formatTime(confirmed.booking.end_time)} is now <strong>{confirmed.booking.status}</strong>.
                        The studio will contact you about the deposit.
                    </p>
                    <Link to={myBookingsPath} className="btn">See my bookings</Link>
                </div>
            )}
        </div>
    );
};

export default Search;
