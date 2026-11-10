import { useState } from 'react';
import { Button, Chip, Pagination, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@nextui-org/react';
import { LuInfo, LuPlus, LuTicket } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import { cancelBooking, listMyBookings } from '@/services/bookings';
import { getStudioToday } from '@/services/studio';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import LinkButton from '@/ui/LinkButton';
import { statusColorMap } from '../../../../../../Table/utils';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import Segmented from '../../../../../admin-staff/components/common/Segmented';
import StatusSelect from '../../../../../admin-staff/components/common/StatusSelect';
import { STATUS_COLORS } from '../../../../../admin-staff/components/common/chartTheme';
import { useIsPhone } from '../../profileHelpers';
import BookingCards from './BookingCards';

const PAGE_SIZE = 8;
// Labels are English source text, translated where they are shown.
const SCOPES = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'all', label: 'All' },
];
const STATUSES = ['all', 'pending', 'approved', 'completed', 'rejected', 'cancelled'];
const DEPOSIT_LABELS = { waiting: 'waiting', completed: 'paid', cancelled: 'cancelled' };

async function load(userId) {
    const [today, bookings] = await Promise.all([getStudioToday(), listMyBookings(userId)]);
    return { today, bookings };
}

// The signed-in user's room bookings; a pending one can be cancelled from its row (a card on phones).
const MyBookings = () => {
    const { user } = useAuth();
    const toast = useToast();
    const { t, tn, formatDate } = useI18n();
    const data = useAsync(() => load(user.id), [user.id]);
    const [scope, setScope] = useState('upcoming');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [busyId, setBusyId] = useState(null);
    const isPhone = useIsPhone();

    const today = data.data?.today;
    const all = data.data?.bookings ?? [];
    const inScope = all.filter((b) => !today || scope === 'all' || (scope === 'upcoming' ? b.date >= today : b.date < today));
    const counts = new Map();
    for (const b of inScope) counts.set(b.status, (counts.get(b.status) ?? 0) + 1);
    const visible = inScope
        .filter((b) => status === 'all' || b.status === status)
        .sort((a, b) => (scope === 'upcoming' ? 1 : -1) * (a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)));
    const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages);
    const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
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

    const emptyContent = (
        <div className="tableEmpty">
            <span>{t('No bookings here yet.')}</span>
            <LinkButton to="/rooms" size="sm" variant="flat">
                {t('Book a room')}
            </LinkButton>
        </div>
    );

    const handleCancel = async (id) => {
        if (!window.confirm(t('Cancel booking #{id}?', { id }))) return;
        setBusyId(id);
        try {
            await cancelBooking(id);
            toast.success('Booking cancelled.');
            data.reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <SectionCard
            className="bookingsCard"
            icon={LuTicket}
            title={t('My bookings')}
            subtitle={data.data ? tn(all.length, '{count} booking in total', '{count} bookings in total') : t('Loading…')}
            actions={
                <LinkButton to="/rooms" startContent={<LuPlus aria-hidden="true" />}>
                    {t('Book a room')}
                </LinkButton>
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
                <Segmented label={t('Dates')} options={SCOPES.map((option) => ({ ...option, label: t(option.label) }))} value={scope} onChange={reset(setScope)} />
            </div>

            <AsyncState state={data} isEmpty={false}>
                {isPhone ? (
                    <BookingCards bookings={pageRows} today={today} busyId={busyId} onCancel={handleCancel} empty={emptyContent} />
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
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="sm" variant="flat" className="capitalize" color={statusColorMap[b.status] ?? 'default'}>
                                                {t(b.status)}
                                            </Chip>
                                        </TableCell>
                                        <TableCell>
                                            {b.status === 'pending' ? (
                                                <Button size="sm" color="danger" variant="flat" isLoading={busyId === b.id} onPress={() => handleCancel(b.id)}>
                                                    {t('Cancel')}
                                                </Button>
                                            ) : (
                                                <span className="isMuted">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {pages > 1 && (
                    <div className="tableFooter">
                        <span>{t('Page {page} of {pages}', { page: currentPage, pages })}</span>
                        <Pagination isCompact showControls color="danger" page={currentPage} total={pages} onChange={setPage} />
                    </div>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default MyBookings;
