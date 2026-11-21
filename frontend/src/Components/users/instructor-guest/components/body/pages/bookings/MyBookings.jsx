import { useState } from 'react';
import { Chip, Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@nextui-org/react';
import { LuCalendarDays, LuInfo, LuList, LuPlus, LuTicket } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import { listMyBookings } from '@/services/bookings';
import { getBookingSettings } from '@/services/bookingRefunds';
import { getStudioToday } from '@/services/studio';
import { getTuitionSettings, isPaymentSandbox } from '@/services/tuition';
import { formatTimeRange, formatVnd, studioTimeNow } from '@/lib/format';
import AsyncState from '@/ui/feedback/AsyncState';
import LinkButton from '@/ui/LinkButton';
import BookingPayDialog from '@/ui/payment/BookingPayDialog';
import BookingReceipt from '@/ui/payment/BookingReceipt';
import { paymentState } from '@/ui/payment/bookingMoney';
import { bookingBalance } from '@/services/bookingPayments';
import PolicyPopover from '@/ui/refunds/PolicyPopover';
import RefundLine from '@/ui/refunds/RefundLine';
import { guestCanCancel } from '@/ui/refunds/refundText';
import { statusColorMap } from '../../../../../../Table/utils';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import Segmented from '../../../../../admin-staff/components/common/Segmented';
import StatusSelect from '../../../../../admin-staff/components/common/StatusSelect';
import { STATUS_COLORS } from '../../../../../admin-staff/components/common/chartTheme';
import { useIsPhone } from '../../profileHelpers';
import BookingActions from './BookingActions';
import BookingCards from './BookingCards';
import BookingsCalendar, { MonthNav } from './BookingsCalendar';
import BookingsDayDialog from './BookingsDayDialog';
import { DEPOSIT_LABELS, defaultMonth, inMonth, monthOf, readView, rememberView } from './bookingsCalendarModel';
import CancelBookingDialog from './CancelBookingDialog';
import './myBookings.scss';

const PAGE_SIZE = 8;
// Labels are English source text, translated where they are shown.
const SCOPES = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
];
const STATUSES = ['all', 'pending', 'approved', 'completed', 'rejected', 'cancelled'];

// The bank account for the QR code, the sandbox flag and the cancellation policy are extras: the list
// still shows without them.
async function load(userId) {
    const [today, bookings, settings, sandbox, policy] = await Promise.all([
        getStudioToday(),
        listMyBookings(userId),
        getTuitionSettings().catch(() => null),
        isPaymentSandbox().catch(() => false),
        getBookingSettings().catch(() => null),
    ]);
    return { today, bookings, settings, sandbox, policy };
}

// A view switch button: its icon, and its word (only for screen readers on phones).
const ViewLabel = ({ icon: Icon, text }) => (
    <>
        <Icon aria-hidden="true" />
        <span className="mbViewText">{text}</span>
    </>
);

// The signed-in user's room bookings. A pending, approved or paid-up (completed) one can be cancelled from
// its row (a card on phones) until it starts: the dialog says what comes back under the cancellation policy,
// and the row then shows the refund. A booking with money due offers "Pay deposit" / "Pay the rest" (the QR pay dialog); each
// has a receipt. List | Calendar (remembered in this browser): the calendar shows a month (‹ › instead of
// Upcoming / Past / All, the status filter still applies); a day opens its bookings with the same buttons.
const MyBookings = () => {
    const { user } = useAuth();
    const { t, tn, formatDate } = useI18n();
    const data = useAsync(() => load(user.id), [user.id]);
    const [scope, setScope] = useState('upcoming');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [cancelling, setCancelling] = useState(null); // booking id in the cancel dialog
    const [paying, setPaying] = useState(null); // booking id in the pay dialog
    const [receipt, setReceipt] = useState(null); // booking id in the receipt
    const [view, setView] = useState(readView); // 'list' | 'calendar'
    const [month, setMonth] = useState(null); // 'yyyy-MM-01' the calendar shows; null = where the next booking is
    const [picked, setPicked] = useState(null); // the day picked in the phone's calendar
    const [openDay, setOpenDay] = useState(null); // { date, id? } in the day dialog
    const isPhone = useIsPhone();

    const today = data.data?.today;
    const all = data.data?.bookings ?? [];
    const calendar = view === 'calendar';
    const shownMonth = month ?? (data.data ? defaultMonth(all, today) : null);
    // The list counts its period (Upcoming / Past / All), the calendar its month.
    const inScope = calendar
        ? all.filter((b) => shownMonth && inMonth(b.date, shownMonth))
        : all.filter((b) => !today || scope === 'all' || (scope === 'upcoming' ? b.date >= today : b.date < today));
    const counts = new Map();
    for (const b of inScope) counts.set(b.status, (counts.get(b.status) ?? 0) + 1);
    const matching = all.filter((b) => status === 'all' || b.status === status);
    const visible = inScope
        .filter((b) => status === 'all' || b.status === status)
        .sort((a, b) => (scope === 'upcoming' ? 1 : -1) * (a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)));
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const payingBooking = all.find((b) => b.id === paying);
    const receiptBooking = all.find((b) => b.id === receipt);
    const cancellingBooking = all.find((b) => b.id === cancelling);
    const now = studioTimeNow();
    const cancellable = (b) => guestCanCancel(b, today, now);
    const awaitingDeposit = all.filter((b) => b.deposit_status === 'waiting' && ['pending', 'approved'].includes(b.status) && (!today || b.date >= today));

    const statusOptions = STATUSES.map((key) => ({
        key,
        label: t(key === 'all' ? 'Any status' : key[0].toUpperCase() + key.slice(1)),
        count: key === 'all' ? inScope.length : counts.get(key) ?? 0,
        color: STATUS_COLORS[key],
    }));

    const reset = (setter) => (value) => {
        setter(value);
        setPage(1);
    };
    const changeView = (next) => {
        setView(next);
        rememberView(next);
    };
    const goToMonth = (next) => {
        setMonth(next);
        setPicked(null);
    };
    const goToToday = () => {
        setMonth(monthOf(today));
        setPicked(today);
    };
    const handlers = { cancellable, onPay: setPaying, onReceipt: setReceipt, onCancel: setCancelling };
    const dayBookings = openDay ? matching.filter((b) => b.date === openDay.date).sort((a, b) => a.start_time.localeCompare(b.start_time)) : [];

    const emptyContent = (
        <div className="tableEmpty">
            <span>{t('No bookings here yet.')}</span>
            <LinkButton to="/rooms" size="sm" variant="flat">
                {t('Book a room')}
            </LinkButton>
        </div>
    );

    return (
        <SectionCard
            className="bookingsCard"
            icon={LuTicket}
            title={t('My bookings')}
            subtitle={data.data ? tn(all.length, '{count} booking in total', '{count} bookings in total') : t('Loading…')}
            actions={
                <>
                    <PolicyPopover settings={data.data?.policy} variant="flat" size="md" portalClassName="adminPortal" />
                    <LinkButton to="/rooms" startContent={<LuPlus aria-hidden="true" />}>
                        {t('Book a room')}
                    </LinkButton>
                </>
            }
        >
            {awaitingDeposit.length > 0 && (
                <p className="inlineNotice">
                    <LuInfo aria-hidden="true" />
                    <span>
                        <strong>{tn(awaitingDeposit.length, '{count} booking', '{count} bookings')}</strong>{' '}
                        {tn(
                            awaitingDeposit.length,
                            'is waiting for a deposit. The studio confirms your room once it arrives.',
                            'are waiting for a deposit. The studio confirms your room once it arrives.',
                        )}
                    </span>
                </p>
            )}
            <div className="bookingToolbar">
                <StatusSelect label={t('Status')} options={statusOptions} value={status} onChange={reset(setStatus)} />
                <div className="mbToolbarEnd">
                    {calendar ? (
                        shownMonth && <MonthNav month={shownMonth} thisMonth={monthOf(today)} onChange={goToMonth} onToday={goToToday} />
                    ) : (
                        <Segmented label={t('Dates')} options={SCOPES.map((option) => ({ ...option, label: t(option.label) }))} value={scope} onChange={reset(setScope)} />
                    )}
                    <Segmented
                        label={t('Show the bookings as')}
                        className="mbViews"
                        options={[
                            { key: 'list', label: <ViewLabel icon={LuList} text={t('List')} /> },
                            { key: 'calendar', label: <ViewLabel icon={LuCalendarDays} text={t('Calendar')} /> },
                        ]}
                        value={view}
                        onChange={changeView}
                    />
                </div>
            </div>

            <AsyncState state={data} isEmpty={false}>
                {calendar ? (
                    <BookingsCalendar
                        month={shownMonth}
                        bookings={matching}
                        today={today}
                        isPhone={isPhone}
                        busy={data.loading}
                        filtered={status !== 'all'}
                        picked={picked}
                        onPick={setPicked}
                        onOpenDay={(date, id) => setOpenDay({ date, id })}
                        renderDay={(bookings) => (
                            <BookingCards bookings={bookings} today={today} {...handlers} empty={<p className="mbDayEmpty">{t('Nothing booked on this day.')}</p>} />
                        )}
                    />
                ) : isPhone ? (
                    <BookingCards bookings={pageRows} today={today} {...handlers} empty={emptyContent} />
                ) : (
                    <div className="tableScroll">
                        <Table aria-label={t('My bookings')} removeWrapper className="bookingTable">
                            <TableHeader>
                                <TableColumn>{t('Booking')}</TableColumn>
                                <TableColumn>{t('Room')}</TableColumn>
                                <TableColumn>{t('When')}</TableColumn>
                                <TableColumn>{t('Payment')}</TableColumn>
                                <TableColumn>{t('Status')}</TableColumn>
                                <TableColumn align="end">{t('Actions')}</TableColumn>
                            </TableHeader>
                            <TableBody
                                items={pageRows}
                                emptyContent={emptyContent}
                            >
                                {(b) => (
                                    <TableRow key={b.id}>
                                        <TableCell>
                                            <span className="bookingId">#{b.id}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="roomPill">{b.room?.name}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="stackCell">
                                                <strong>
                                                    {formatDate(b.date, 'shortYear')}
                                                    {b.date === today && <span className="todayTag">{t('Today')}</span>}
                                                </strong>
                                                <span>
                                                    {formatTimeRange(b.start_time, b.end_time)}
                                                    <span className="sr-only"> ({b.date})</span>
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="stackCell">
                                                <strong>{formatVnd(b.full_payment)}</strong>
                                                <span>
                                                    {t('Deposit {amount}', { amount: formatVnd(b.deposit) })} ·{' '}
                                                    <span className={`depositState is-${b.deposit_status}`}>{t(DEPOSIT_LABELS[b.deposit_status] ?? b.deposit_status)}</span>
                                                </span>
                                                <span className={`payState tone-${paymentState(b).tone}`}>{t(paymentState(b).label)}</span>
                                                {bookingBalance(b) > 0 && <span className="payLeft">{t('Still to pay {amount}', { amount: formatVnd(bookingBalance(b)) })}</span>}
                                                <RefundLine booking={b} />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[b.status] ?? 'default'}>
                                                {t(b.status)}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            <BookingActions booking={b} {...handlers} />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {!calendar && pages > 1 && (
                    <div className="tableFooter">
                        <span>{t('Page {page} of {pages}', { page: currentPage, pages })}</span>
                        <Pagination isCompact showControls color="danger" page={currentPage} total={pages} onChange={setPage} />
                    </div>
                )}
            </AsyncState>

            {calendar && openDay && (
                <BookingsDayDialog
                    date={openDay.date}
                    bookings={dayBookings}
                    today={today}
                    highlight={openDay.id}
                    isOpen={!payingBooking && !receiptBooking && !cancellingBooking}
                    {...handlers}
                    onClose={() => setOpenDay(null)}
                />
            )}
            {payingBooking && (
                <BookingPayDialog
                    booking={payingBooking}
                    settings={data.data?.settings}
                    sandbox={Boolean(data.data?.sandbox)}
                    onClose={() => setPaying(null)}
                    onChanged={data.reload}
                />
            )}
            {cancellingBooking && (
                <CancelBookingDialog booking={cancellingBooking} settings={data.data?.policy} onClose={() => setCancelling(null)} onCancelled={data.reload} />
            )}
            {receiptBooking && (
                <BookingReceipt
                    booking={receiptBooking}
                    guest={{ name: user.full_name || user.username, phone: user.contact_number, email: user.email }}
                    today={today}
                    onClose={() => setReceipt(null)}
                />
            )}
        </SectionCard>
    );
};

export default MyBookings;
