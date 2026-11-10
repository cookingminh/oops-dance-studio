import { LuHourglass } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../../common/Segmented';
import StatusSelect from '../../../common/StatusSelect';
import { SCOPES } from '../bookingsModel';

// Room tabs, the "Awaiting approval" quick filter, the status filter and (table only) the date scope.
const BookingFilters = ({ roomOptions, room, onRoom, statusOptions, status, onStatus, pendingCount, scope, onScope }) => {
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
                <StatusSelect label={t('Status')} options={statusOptions} value={status} onChange={onStatus} />
                {scope && (
                    <Segmented label={t('Dates')} options={SCOPES.map((option) => ({ ...option, label: t(option.label) }))} value={scope} onChange={onScope} />
                )}
            </div>
        </div>
    );
};

export default BookingFilters;
