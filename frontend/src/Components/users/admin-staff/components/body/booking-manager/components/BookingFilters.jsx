import { LuHourglass, LuUndo2, LuWallet } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../../common/Segmented';
import StatusSelect from '../../../common/StatusSelect';
import { SCOPES } from '../bookingsModel';

// Room tabs, the "Awaiting approval", "Owes money" and "To refund" quick filters (the last two only while
// something is owed / due back, or while on), the status filter and (table only) the date scope.
const BookingFilters = ({
    roomOptions,
    room,
    onRoom,
    statusOptions,
    status,
    onStatus,
    pendingCount,
    owingCount = 0,
    owing = false,
    onOwing,
    refundCount = 0,
    refunds = false,
    onRefunds,
    scope,
    onScope,
}) => {
    const { t } = useI18n();
    const awaiting = status === 'pending';
    return (
        <div className="bookingToolbar">
            <Segmented label={t('Room')} options={roomOptions} value={room} onChange={onRoom} className="isRooms" />
            <div className="toolbarGroup">
                <button
                    type="button"
                    className={`awaitChip${pendingCount ? ' hasPending' : ''}`}
                    aria-pressed={awaiting}
                    onClick={() => onStatus(awaiting ? 'all' : 'pending')}
                >
                    <LuHourglass aria-hidden="true" />
                    {t('Awaiting approval')}
                    <span className="segCount">{pendingCount}</span>
                </button>
                {onOwing && (owingCount > 0 || owing) && (
                    <button type="button" className={`awaitChip isOwing${owingCount ? ' hasPending' : ''}`} aria-pressed={owing} onClick={() => onOwing(!owing)}>
                        <LuWallet aria-hidden="true" />
                        {t('Owes money')}
                        <span className="segCount">{owingCount}</span>
                    </button>
                )}
                {onRefunds && (refundCount > 0 || refunds) && (
                    <button type="button" className={`awaitChip isRefund${refundCount ? ' hasPending' : ''}`} aria-pressed={refunds} onClick={() => onRefunds(!refunds)}>
                        <LuUndo2 aria-hidden="true" />
                        {t('To refund')}
                        <span className="segCount">{refundCount}</span>
                    </button>
                )}
                <StatusSelect label={t('Status')} options={statusOptions} value={status} onChange={onStatus} />
                {scope && (
                    <Segmented label={t('Dates')} options={SCOPES.map((option) => ({ ...option, label: t(option.label) }))} value={scope} onChange={onScope} />
                )}
            </div>
        </div>
    );
};

export default BookingFilters;
