import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuArrowUpRight, LuSearch, LuSearchX, LuTicket } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { bookingBalance, findBooking } from '@/services/bookingPayments';
import { findInvoiceByCode } from '@/services/tuitionBoard';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import LinkButton from '@/ui/LinkButton';
import SectionCard from '../../common/SectionCard';
import { stagger } from '../../common/motion';
import { fold, invoiceSearchText, lookupOf, withCourses } from './tuitionModel';
import InvoiceRow from './InvoiceRow';

const SHOWN = 40;

// Looks a code up beyond the lists on the page: an invoice of an older course, or a room booking.
async function lookUp(lookup) {
    if (!lookup) return null;
    if (lookup.kind === 'booking') return { invoice: null, booking: await findBooking(lookup.term) };
    const [invoice, booking] = await Promise.all([findInvoiceByCode(lookup.term), findBooking(lookup.term)]);
    return { invoice, booking };
}

// A room booking found by its code or number, with a link to it on the Bookings page.
const BookingHit = ({ booking }) => {
    const { t, formatDate } = useI18n();
    const owed = bookingBalance(booking);
    const guest = booking.guest?.full_name || booking.guest?.username || t('Guest');
    return (
        <div className="tuBookingHit" data-booking={booking.id}>
            <span className="tuTransferIcon" aria-hidden="true">
                <LuTicket />
            </span>
            <span className="tuBookingHitText">
                <strong>
                    {t('Booking #{id}', { id: booking.id })} · {guest}
                </strong>
                <small>
                    {[booking.room?.name, `${formatDate(booking.date, 'short')} ${formatTimeRange(booking.start_time, booking.end_time)}`, t(booking.status)].filter(Boolean).join(' · ')}
                    {' · '}
                    <span className="tuMono">{booking.payment_code}</span>
                </small>
                <small className={owed ? 'isOwed' : 'isClear'}>{owed ? t('{amount} still to pay', { amount: formatVnd(owed) }) : t('Nothing left to pay')}</small>
            </span>
            <LinkButton to={`/admin/bookings?booking=${booking.id}`} size="sm" variant="flat" startContent={<LuArrowUpRight aria-hidden="true" />}>
                {t('Open booking')}
            </LinkButton>
        </div>
    );
};

// What the search box finds: invoices of the courses on the page (running, next, anything still owed)
// by student, phone, class, course or code — and, for an OOPS code or a booking number, an older
// invoice or the room booking it belongs to.
const SearchResults = ({ query, invoices, progressById, today, enrolments, busyId, onAction, onClear }) => {
    const { t, tn } = useI18n();
    const term = fold(query.trim());
    const matches = useMemo(
        () =>
            invoices
                .filter((invoice) => invoiceSearchText(invoice).includes(term))
                .sort((a, b) => a.student_name.localeCompare(b.student_name, 'vi') || (b.course?.starts_on ?? '').localeCompare(a.course?.starts_on ?? '')),
        [invoices, term],
    );
    const lookup = lookupOf(query);
    // Codes on the page are found above; look further only for one that isn't.
    const needsLookup = lookup && !(lookup.kind === 'code' && matches.length > 0);
    const found = useAsync(() => lookUp(needsLookup ? lookup : null), [needsLookup ? `${lookup.kind}:${lookup.term}` : '']);
    // A result from an earlier search stays in `data` while the next one loads: not shown.
    const hit = found.loading ? null : found.data;
    const extra = hit?.invoice && !matches.some((invoice) => invoice.id === hit.invoice.id) ? withCourses([hit.invoice], progressById, today) : [];
    const booking = hit?.booking ?? null;
    const rows = [...matches, ...extra];
    const shown = rows.slice(0, SHOWN);
    const total = rows.length + (booking ? 1 : 0);

    return (
        <SectionCard
            id="tuition-search"
            className="tuSearchCard"
            icon={LuSearch}
            title={t('Search')}
            subtitle={found.loading && needsLookup ? t('Looking up {code}…', { code: lookup.term }) : tn(total, '{count} result for “{query}”', '{count} results for “{query}”', { query: query.trim() })}
            actions={
                <Button variant="light" onPress={onClear}>
                    {t('Clear search')}
                </Button>
            }
        >
            {booking && <BookingHit booking={booking} />}
            {shown.length > 0 && (
                <motion.ul key={term} className="tuRows" variants={stagger} initial="hidden" animate="show">
                    {shown.map((invoice) => (
                        <InvoiceRow
                            key={invoice.id}
                            invoice={invoice}
                            invoices={rows}
                            today={today}
                            place={enrolments?.get(`${invoice.class_id}:${invoice.student_id}`) ?? null}
                            busy={busyId === invoice.id}
                            onAction={onAction}
                            showClass
                            quick
                        />
                    ))}
                </motion.ul>
            )}
            {rows.length > SHOWN && <p className="tuFinePrint">{t('Showing the first {count}. Type more of the name to narrow it down.', { count: SHOWN })}</p>}
            {total === 0 && !(found.loading && needsLookup) && (
                <div className="tuCalm isQuiet">
                    <span aria-hidden="true">
                        <LuSearchX />
                    </span>
                    <strong>{t('Nothing matches “{query}”', { query: query.trim() })}</strong>
                    <small>{t('Try part of the name, the phone number, the class or the OOPS code.')}</small>
                </div>
            )}
            <p className="tuFinePrint tuSearchScope">{t('Searches the courses running now and next, and anything still owed. A code also finds older invoices and room bookings.')}</p>
        </SectionCard>
    );
};

export default SearchResults;
