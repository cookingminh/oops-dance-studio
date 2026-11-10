import {
    Button,
    Chip,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Pagination,
    Table,
    TableBody,
    TableCell,
    TableColumn,
    TableHeader,
    TableRow,
    Tooltip,
    User,
} from '@nextui-org/react';
import { LuCheck, LuStickyNote, LuX } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { VerticalDotsIcon } from '../../../../../../../Table/VerticalDotsIcon';
import { statusColorMap } from '../../../../../../../Table/utils';
import { DEPOSIT_LABELS, QUICK_ACTIONS } from '../../useBookingActions';
import { PAGE_SIZE, guestName } from '../../bookingsModel';

const COLUMNS = [
    { key: 'id', label: 'Booking' },
    { key: 'guest', label: 'Guest' },
    { key: 'room', label: 'Room' },
    { key: 'when', label: 'When' },
    { key: 'payment', label: 'Payment' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
];

// The searchable table of bookings (the page filters and sorts; this shows one page of `rows`).
// Pending requests can be approved or rejected right from their row; the ⋮ menu has the rest.
// Row actions sit in fixed slots (note · reject + approve · menu) so they line up down the table.
const BookingList = ({ state, rows, total, page, onPage, todayIso, roomColor, actions, onOpen, onEdit, onClearFilters }) => {
    const { t, formatDate } = useI18n();
    const { busyId, setStatus, remove } = actions;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const renderCell = (booking, key) => {
        switch (key) {
            case 'id':
                return (
                    <button type="button" className="bookingId" onClick={() => onOpen(booking)} aria-label={t('Open booking {id}', { id: booking.id })}>
                        #{booking.id}
                    </button>
                );
            case 'guest': {
                const name = guestName(booking, t);
                return (
                    <User
                        avatarProps={{ ...AVATAR_DEFAULTS, radius: 'full', size: 'sm', src: avatarUrl(booking.guest?.avatar_path, booking.guest?.updated_at) ?? undefined, name }}
                        name={name}
                        description={booking.guest?.email}
                    />
                );
            }
            case 'room':
                return (
                    <span className="roomPill">
                        <span className="segDot" style={{ background: roomColor.get(booking.room_id) }} aria-hidden="true" />
                        {booking.room?.name}
                    </span>
                );
            case 'when': {
                const sameYear = booking.date.slice(0, 4) === (todayIso ?? '').slice(0, 4);
                return (
                    <div className="stackCell">
                        <strong>
                            {formatDate(booking.date, sameYear ? 'short' : 'shortYear')}
                            {booking.date === todayIso && <span className="todayTag">{t('Today')}</span>}
                        </strong>
                        <span>{formatTimeRange(booking.start_time, booking.end_time)}</span>
                    </div>
                );
            }
            case 'payment':
                return (
                    <div className="stackCell">
                        <strong>{formatVnd(booking.full_payment)}</strong>
                        <span>
                            {t('Deposit {amount}', { amount: formatVnd(booking.deposit) })} ·{' '}
                            <span className={`depositState is-${booking.deposit_status}`}>{t(DEPOSIT_LABELS[booking.deposit_status] ?? booking.deposit_status)}</span>
                        </span>
                    </div>
                );
            case 'status':
                return (
                    <Chip className="capitalize" color={statusColorMap[booking.status] ?? 'default'} size="sm" variant="flat">
                        {t(booking.status)}
                    </Chip>
                );
            case 'actions':
                return (
                    <div className="rowActions">
                        {!booking.details && <span className="actionSlot" aria-hidden="true" />}
                        {booking.details && (
                            <Tooltip content={<span className="noteTooltip">{booking.details}</span>}>
                                <Button isIconOnly size="sm" variant="light" aria-label={t('Note for booking {id}', { id: booking.id })}>
                                    <LuStickyNote className="text-default-500" />
                                </Button>
                            </Tooltip>
                        )}
                        {booking.status !== 'pending' && <span className="actionSlot isDouble" aria-hidden="true" />}
                        {booking.status === 'pending' && (
                            <>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    color="danger"
                                    aria-label={t('Reject booking {id}', { id: booking.id })}
                                    isDisabled={busyId === booking.id}
                                    onPress={() => setStatus(booking.id, 'rejected')}
                                >
                                    <LuX />
                                </Button>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    color="success"
                                    className="text-white"
                                    aria-label={t('Approve booking {id}', { id: booking.id })}
                                    isLoading={busyId === booking.id}
                                    onPress={() => setStatus(booking.id, 'approved')}
                                >
                                    <LuCheck />
                                </Button>
                            </>
                        )}
                        <Dropdown>
                            <DropdownTrigger>
                                <Button isIconOnly size="sm" variant="light" aria-label={t('Actions for booking {id}', { id: booking.id })}>
                                    <VerticalDotsIcon className="text-default-400" />
                                </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label={t('Booking actions')}>
                                {[
                                    ...(QUICK_ACTIONS[booking.status] ?? []).map(([status, label]) => (
                                        <DropdownItem key={status} onPress={() => setStatus(booking.id, status)}>{t(label)}</DropdownItem>
                                    )),
                                    <DropdownItem key="edit" onPress={() => onEdit(booking)}>{t('Edit booking')}</DropdownItem>,
                                    <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => remove(booking.id)}>
                                        {t('Delete booking')}
                                    </DropdownItem>,
                                ]}
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                );
            default:
                return null;
        }
    };

    const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(page * PAGE_SIZE, total);

    return (
        <AsyncState state={state} isEmpty={false}>
            <div className="tableScroll">
                <Table aria-label={t('Bookings')} removeWrapper className="bookingTable">
                    <TableHeader columns={COLUMNS}>
                        {(column) => (
                            <TableColumn key={column.key} align={column.key === 'actions' ? 'end' : 'start'}>
                                {t(column.label)}
                            </TableColumn>
                        )}
                    </TableHeader>
                    <TableBody
                        items={rows}
                        emptyContent={
                            <div className="tableEmpty">
                                <span>{t('No bookings match these filters.')}</span>
                                <Button size="sm" variant="flat" onPress={onClearFilters}>{t('Show every booking')}</Button>
                            </div>
                        }
                    >
                        {(booking) => (
                            <TableRow key={booking.id}>
                                {(key) => <TableCell>{renderCell(booking, key)}</TableCell>}
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {total > 0 && (
                <div className="tableFooter">
                    <span>{t('{from}–{to} of {total}', { from, to, total })}</span>
                    {pages > 1 && <Pagination isCompact showControls color="danger" page={page} total={pages} onChange={onPage} />}
                </div>
            )}
        </AsyncState>
    );
};

export default BookingList;
