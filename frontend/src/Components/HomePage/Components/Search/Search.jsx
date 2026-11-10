import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseISO } from 'date-fns';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuCalendarDays, LuCheck, LuChevronDown, LuCircleSlash, LuClock, LuLogIn, LuPartyPopper, LuRuler, LuSearch, LuShieldCheck, LuSparkles, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { DASHBOARD_ROLES } from '@/auth/roles';
import { createBooking, getAvailableSlots } from '@/services/bookings';
import { getBookingSettings } from '@/services/bookingRefunds';
import { getStudioToday } from '@/services/studio';
import { roomImageUrls } from '@/services/storage';
import { useToast } from '@/ui/feedback/toastContext';
import LinkButton from '@/ui/LinkButton';
import PolicyLines from '@/ui/refunds/PolicyLines';
import { policyLines } from '@/ui/refunds/refundText';
import { TIME_OPTIONS, formatTime, formatVnd, toIsoDate, toMinutes } from '@/lib/format';
import { ALL_ROOMS, lowestPrice } from './rooms';
import studioPhoto from '@/assets/images/studio.webp';
import './Search.scss';

// Booking dialogs sit above the fixed navbar (z 1000).
const MODAL_LAYER = { wrapper: 'z-[1200]', backdrop: 'z-[1200]' };
const OPEN = toMinutes('08:00');
const CLOSE = toMinutes('22:00');
const EASE = [0.22, 1, 0.36, 1];

// A requested range is bookable if one free window fully contains it.
const fits = (windows, start, end) =>
    windows.some((w) => toMinutes(formatTime(w.start_time)) <= toMinutes(start) && toMinutes(end) <= toMinutes(formatTime(w.end_time)));

// Position of a time on the 08:00–22:00 bar, in %.
const at = (time) => ((toMinutes(time) - OPEN) / (CLOSE - OPEN)) * 100;

// Roughly how wide a time label is ("15:30" at .7rem), for deciding what fits.
const LABEL_PX = 36;

// The bar's width in px (labels are placed in %, but whether they fit depends on the real width).
function useWidth() {
    const [node, setNode] = useState(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        if (!node) return undefined;
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
        observer.observe(node);
        return () => observer.disconnect();
    }, [node]);
    return [setNode, width];
}

// Labels for the free windows only: each window's start (left-aligned on it) and end (right-aligned
// on it). A window too short for both gets one "start–end" label centred on it, or just its start when
// even that collides; labels stay inside the bar and never overlap (the row above lists every window).
function freeLabels(windows, width) {
    const px = (pct) => (pct / 100) * width;
    const clamp = (left, w) => Math.min(Math.max(left, 0), Math.max(width - w, 0));
    const labels = [];
    let lastRight = -Infinity;
    // Places the first candidate that doesn't overlap the previous label.
    const place = (...candidates) => {
        const label = candidates.find((c) => c.left >= lastRight + 4);
        if (!label) return;
        labels.push(label);
        lastRight = label.left + label.width;
    };
    for (const w of windows) {
        const from = formatTime(w.start_time);
        const to = formatTime(w.end_time);
        const a = px(at(from));
        const b = px(at(to));
        const startOnly = { key: `${from}-s`, text: from, left: clamp(a, LABEL_PX), width: LABEL_PX, align: 'start' };
        if (b - a >= LABEL_PX * 2 + 6) {
            place(startOnly);
            place({ key: `${to}-e`, text: to, left: clamp(b - LABEL_PX, LABEL_PX), width: LABEL_PX, align: 'end' });
        } else {
            const span = LABEL_PX * 2 + 4;
            place({ key: `${from}-r`, text: `${from}–${to}`, left: clamp((a + b) / 2 - span / 2, span), width: span, align: 'center' }, startOnly);
        }
    }
    return labels;
}

// The opening day as a bar: free windows in green with their times, the requested range outlined.
const DayBar = ({ windows, start, end }) => {
    const [ref, width] = useWidth();
    return (
        <div className="dayBar" aria-hidden="true">
            <div className="dayBarTrack" ref={ref}>
                {windows.map((w) => {
                    const from = formatTime(w.start_time);
                    const to = formatTime(w.end_time);
                    return <span key={from} className="dayBarFree" style={{ left: `${at(from)}%`, width: `${at(to) - at(from)}%` }} />;
                })}
                {start && end && <span className="dayBarPick" style={{ left: `${at(start)}%`, width: `${at(end) - at(start)}%` }} />}
            </div>
            <div className="dayBarScale">
                {width > 0 &&
                    freeLabels(windows, width).map((label) => (
                        <span key={label.key} className={`is-${label.align}`} style={{ left: label.left, width: label.width }}>
                            {label.text}
                        </span>
                    ))}
            </div>
        </div>
    );
};

// The cancellation policy under the booking summary: its main step on one line, the other steps one tap
// away ("Details"). Nothing shows when the policy can't be read.
const BookingPolicy = ({ settings }) => {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    if (!settings) return null;
    const [first, ...rest] = policyLines(settings);
    return (
        <div className="hpBookPolicy" role="group" aria-label={t('Cancellation policy')}>
            <p>
                <LuShieldCheck aria-hidden="true" />
                <span>{t(first.key, first.vars)}</span>
                <button type="button" aria-expanded={open} aria-controls="hp-book-policy" onClick={() => setOpen((value) => !value)} className={open ? 'isOpen' : undefined}>
                    {t('Details')} <LuChevronDown aria-hidden="true" />
                </button>
            </p>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        id="hp-book-policy"
                        key="policy"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: EASE }}
                        style={{ overflow: 'hidden' }}
                    >
                        <PolicyLines lines={rest} className="hpBookPolicyLines" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// /rooms: pick a room, a day and the hours, see live availability, then book. `rooms` is the page's
// useAsync(listRooms) result; the selected room is lifted to the page so the room cards can pick one.
const Search = ({ rooms, selectedRoom, onSelectRoom }) => {
    const { user, isAuthenticated } = useAuth();
    const { t, formatDate, dateLocale } = useI18n();
    const toast = useToast();
    const [today, setToday] = useState(() => new Date());
    const [date, setDate] = useState(() => new Date());
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [slots, setSlots] = useState(null); // { [roomId]: windows[] } for the searched date
    const [searchedDate, setSearchedDate] = useState(null);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [bookingRoom, setBookingRoom] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmed, setConfirmed] = useState(null);
    const [policy, setPolicy] = useState(null); // the cancellation policy (shown before confirming)

    useEffect(() => {
        // Public (booking_settings is readable by visitors); the booking works without it.
        getBookingSettings()
            .then(setPolicy)
            .catch(() => {});
    }, []);

    useEffect(() => {
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

    const roomList = rooms.data ?? [];
    const visibleRooms = roomList.filter((room) => selectedRoom === ALL_ROOMS || room.id === selectedRoom);
    const focusRoom = roomList.find((room) => room.id === selectedRoom);

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
    const tabs = [...roomList.map((room) => ({ key: room.id, label: room.name })), { key: ALL_ROOMS, label: t('All Rooms') }];

    return (
        <section id="book" className="search hpBook">
            <div className="hpBookCard">
                {/* Left: the room you're looking at */}
                <div className="hpBookVisual">
                    {/* Cross-fade: the new photo fades in on top while the old one stays underneath until it's covered. */}
                    <AnimatePresence initial={false}>
                        <motion.div
                            key={String(selectedRoom)}
                            className="hpBookPhotos"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, zIndex: 1 }}
                            exit={{ opacity: 0, zIndex: 0, transition: { opacity: { delay: 0.45, duration: 0 }, zIndex: { duration: 0 } } }}
                            transition={{ duration: 0.45, ease: 'easeOut' }}
                        >
                            {(focusRoom ? [focusRoom] : roomList.slice(0, 2)).map((room) => (
                                <img key={room.id} src={roomImageUrls(room)[0] ?? studioPhoto} alt="" />
                            ))}
                        </motion.div>
                    </AnimatePresence>
                    <div className="hpBookShade" />
                    <AnimatePresence initial={false}>
                        <motion.div
                            key={String(selectedRoom)}
                            className="hpBookCaption"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            transition={{ duration: 0.35, delay: 0.1, ease: EASE }}
                        >
                            {focusRoom ? (
                                <>
                                    <h3>{focusRoom.name}</h3>
                                    {focusRoom.size && (
                                        <p>
                                            <LuRuler aria-hidden="true" /> {focusRoom.size}
                                        </p>
                                    )}
                                    <span className="hpBookPrice">
                                        {formatVnd(focusRoom.price)}
                                        <small>{t('/ hour')}</small>
                                    </span>
                                </>
                            ) : (
                                <>
                                    <h3>{t('All rooms')}</h3>
                                    <p>
                                        {t('{count} mirrored studios · from {price} an hour', {
                                            count: roomList.length,
                                            price: roomList.length ? formatVnd(lowestPrice(roomList)) : '—',
                                        })}
                                    </p>
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Right: what and when */}
                <div className="hpBookForm">
                    <h2 className="hpBookTitle">{t('Find a free slot to practise')}</h2>
                    <div className="hpRoomTabs" role="group" aria-label={t('Room')}>
                        {tabs.map((tab) => (
                            <button
                                type="button"
                                key={tab.key}
                                aria-pressed={selectedRoom === tab.key}
                                className={selectedRoom === tab.key ? 'active' : undefined}
                                onClick={() => onSelectRoom(tab.key)}
                            >
                                {selectedRoom === tab.key && (
                                    <motion.span layoutId="hpRoomTab" className="hpRoomTabPill" transition={{ type: 'spring', bounce: 0, duration: 0.4 }} />
                                )}
                                <span className="hpRoomTabLabel">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="hpBookFields">
                        <label className="hpField isDate">
                            <span className="hpFieldLabel">
                                <LuCalendarDays aria-hidden="true" /> {t('Date')}
                            </span>
                            <DatePicker
                                selected={date}
                                onChange={(value) => {
                                    if (value) setDate(value);
                                    clearResults();
                                }}
                                minDate={today}
                                dateFormat="dd/MM/yyyy"
                                locale={dateLocale}
                                placeholderText={t('Choose a date')}
                            />
                        </label>
                        <label className="hpField">
                            <span className="hpFieldLabel">
                                <LuClock aria-hidden="true" /> {t('Check in')}
                            </span>
                            <select
                                aria-label={t('Check-in time')}
                                value={startTime}
                                onChange={(event) => {
                                    setStartTime(event.target.value);
                                    clearResults();
                                }}
                            >
                                <option value="">{t('Any time')}</option>
                                {TIME_OPTIONS.slice(0, -1).map((time) => (
                                    <option key={time} value={time}>{time}</option>
                                ))}
                            </select>
                        </label>
                        <label className="hpField">
                            <span className="hpFieldLabel">
                                <LuClock aria-hidden="true" /> {t('Check out')}
                            </span>
                            <select
                                aria-label={t('Check-out time')}
                                value={endTime}
                                onChange={(event) => {
                                    setEndTime(event.target.value);
                                    clearResults();
                                }}
                            >
                                <option value="">{t('Any time')}</option>
                                {TIME_OPTIONS.slice(1).map((time) => (
                                    <option key={time} value={time}>{time}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <button type="button" className="hpSearchBtn" onClick={handleSearch} disabled={searching || Boolean(timeError)}>
                        <LuSearch aria-hidden="true" />
                        {searching ? t('Searching…') : t('Search Room')}
                    </button>

                    {!slots && !timeError && !searchError && (
                        <p className="hpBookHint">
                            <LuSparkles aria-hidden="true" />
                            {t('Tip: leave the times on “Any time” to see every free hour of the day.')}
                        </p>
                    )}

                    {(timeError || searchError || rooms.error) && (
                        <div className="hpBookError" role="alert">
                            {t(timeError || searchError || rooms.error.message)}
                        </div>
                    )}

                    <div className={`searchResult ${slots ? 'visible' : 'hidden'}`}>
                        {slots && (
                            <div className="hpResultTop">
                                <p className="hpResultTitle">
                                    {formatDate(searchedDate, 'long')}
                                    {startTime && endTime ? ` · ${startTime}–${endTime}` : ` · ${t('free hours')}`}
                                </p>
                                <span className="hpLegend" aria-hidden="true">
                                    <span className="isFree" /> {t('Free')}
                                    <span className="isBusy" /> {t('Booked or past')}
                                    {startTime && endTime && <span className="isPick" />}
                                    {startTime && endTime && t('Your time')}
                                </span>
                            </div>
                        )}
                        {/* No exit animation: a row that leaves must not keep its space (the card would grow, then shrink). */}
                        {slots &&
                                visibleRooms.map((room, index) => {
                                    const windows = slots[room.id] ?? [];
                                    const hasRange = startTime && endTime;
                                    const free = hasRange && fits(windows, startTime, endTime);
                                    return (
                                        <motion.div
                                            key={room.id}
                                            className={`hpResult ${hasRange ? (free ? 'isFree' : 'isTaken') : ''}`}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3, delay: index * 0.05, ease: EASE }}
                                        >
                                            <div className="hpResultHead">
                                                <strong>{room.name}</strong>
                                                {hasRange ? (
                                                    free ? (
                                                        <span className="hpResultState">
                                                            <LuCheck aria-hidden="true" /> {t('{room} is available from {start} to {end}', { room: room.name, start: startTime, end: endTime })}
                                                        </span>
                                                    ) : (
                                                        <span className="hpResultState">
                                                            <LuCircleSlash aria-hidden="true" /> {t('{room} is not available from {start} to {end}', { room: room.name, start: startTime, end: endTime })}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="hpResultState">
                                                        {windows.length ? windows.map((w) => `${formatTime(w.start_time)}–${formatTime(w.end_time)}`).join(' · ') : t('Fully booked on this day.')}
                                                    </span>
                                                )}
                                                {free && (
                                                    <button type="button" className="hpBookNow" onClick={() => setBookingRoom(room)}>
                                                        {t('Book Now')}
                                                    </button>
                                                )}
                                            </div>
                                            <DayBar windows={windows} start={hasRange ? startTime : null} end={hasRange ? endTime : null} />
                                        </motion.div>
                                    );
                                })}
                    </div>
                </div>
            </div>

            {/* Booking: confirm the details, or log in first */}
            <Modal isOpen={Boolean(bookingRoom)} onOpenChange={(open) => !open && setBookingRoom(null)} placement="center" backdrop="blur" classNames={MODAL_LAYER}>
                <ModalContent>
                    {bookingRoom && isAuthenticated && (
                        <form onSubmit={handleConfirm}>
                            <ModalHeader className="flex flex-col gap-1">
                                <h2 className="text-xl font-bold">{t('Your Booking')}</h2>
                                <span className="text-small font-normal text-default-500">{t('Please check the details before you confirm.')}</span>
                            </ModalHeader>
                            <ModalBody>
                                <dl className="hpBookSummary">
                                    <div>
                                        <dt>{t('Guest')}</dt>
                                        <dd>{user?.full_name || user?.username || user?.email}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Room')}</dt>
                                        <dd>{bookingRoom.name}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Date')}</dt>
                                        <dd>{formatDate(date, 'full')}</dd>
                                    </div>
                                    <div>
                                        <dt>{t('Time')}</dt>
                                        <dd>
                                            {startTime} – {endTime}
                                        </dd>
                                    </div>
                                    {estimate && (
                                        <>
                                            <div>
                                                <dt>{t('Estimated total')}</dt>
                                                <dd>
                                                    {formatVnd(estimate.total)} <small>{t('({hours} h × {price})', { hours: estimate.hours, price: formatVnd(bookingRoom.price) })}</small>
                                                </dd>
                                            </div>
                                            <div className="isDeposit">
                                                <dt>{t('Deposit (50%)')}</dt>
                                                <dd>{formatVnd(estimate.deposit)}</dd>
                                            </div>
                                        </>
                                    )}
                                </dl>
                                <BookingPolicy settings={policy} />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={() => setBookingRoom(null)} isDisabled={submitting}>
                                    {t('Close')}
                                </Button>
                                <Button type="submit" color="danger" isLoading={submitting}>
                                    {t('Confirm')}
                                </Button>
                            </ModalFooter>
                        </form>
                    )}
                    {bookingRoom && !isAuthenticated && (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                <span>{t('Please log in to book a room')}</span>
                                <span className="text-small font-normal text-default-500">
                                    {t('Log in or create an account, then search again to book this slot.')}
                                </span>
                            </ModalHeader>
                            <ModalFooter>
                                <LinkButton to="/register" variant="light">
                                    {t('No account yet? Sign up')}
                                </LinkButton>
                                <LinkButton to="/login" state={{ from: { pathname: '/rooms', hash: '#book' } }} startContent={<LuLogIn aria-hidden="true" />}>
                                    {t('Log in')}
                                </LinkButton>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={Boolean(confirmed)} onOpenChange={(open) => !open && setConfirmed(null)} placement="center" backdrop="blur" classNames={MODAL_LAYER}>
                <ModalContent>
                    {confirmed && (
                        <div className="confirmation hpConfirmed" role="status">
                            <span className="hpConfirmedIcon" aria-hidden="true">
                                <LuPartyPopper />
                            </span>
                            <h2>{t('Booking request sent!')}</h2>
                            <p>
                                {t('{room}, {date}, {start}–{end} is now', {
                                    room: confirmed.room.name,
                                    date: formatDate(confirmed.booking.date, 'long'),
                                    start: formatTime(confirmed.booking.start_time),
                                    end: formatTime(confirmed.booking.end_time),
                                })}{' '}
                                <strong>{t(confirmed.booking.status)}</strong>. {t('The studio will contact you about the deposit.')}
                            </p>
                            <div className="hpConfirmedActions">
                                <Button variant="light" startContent={<LuX aria-hidden="true" />} onPress={() => setConfirmed(null)}>
                                    {t('Close')}
                                </Button>
                                <LinkButton to={myBookingsPath}>{t('See my bookings')}</LinkButton>
                            </div>
                        </div>
                    )}
                </ModalContent>
            </Modal>
        </section>
    );
};

export default Search;
