import { LuMapPin } from 'react-icons/lu';
import { Spinner } from '@nextui-org/react';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { sessionState } from '../../hubModel';
import { rentFor, rentOfSession, sessionPlace } from './moneyDays';

// The class's session that day: time, how it went and where ("Studio · Room"). At a rented studio with several
// rooms, the room can be changed for this session only (session_set_venue_room): the picker lists the studio's
// rooms, each with the rent it means for the session (admin); a rent already charged is worked out again at the new
// room's price. A session at a studio is always in one of its rooms.
//   session: monthSessions() entry   costs: the day's costs   onRoom(roomId)   saving: the room being set
const DaySession = ({ session, cls, today, now, places, costs, showRent, saving, onRoom }) => {
    const { t } = useI18n();
    const state = sessionState(session, today, now);
    const place = sessionPlace(session, cls, places);
    const row = session.row;
    const cancelled = row?.status === 'cancelled';
    const rent = rentOfSession(costs, row?.id);
    // Only a studio with more than one room leaves a choice.
    const hasRooms = Boolean(place.venue) && place.rooms.length > 1;
    const canPick = hasRooms && row && !cancelled;
    const current = row?.venue_room_id ?? null;

    const options = canPick ? place.rooms.map((room) => ({ id: room.id, name: room.name, rent: rentFor(room.rent_per_hour, session.start, session.end) })) : [];

    let note = null;
    if (hasRooms && !row) note = t('The room can be changed once this session’s record exists (it is made the week the session runs).');
    else if (canPick && rent) note = t('Rent already charged: {amount}. Picking another room works it out again at that room’s price.', { amount: formatVnd(rent.amount) });
    else if (canPick && session.date >= today) note = t('The rent is added after the session, at the price of the room it is in.');

    return (
        <li className={`mcSessionItem${cancelled ? ' isOff' : ''}`}>
            <div className="mcSessionHead">
                <strong className="mcSessionTime">
                    {session.start}–{session.end}
                </strong>
                <span className={`mcChip tone-${state.tone}`}>{t(state.key, state.vars)}</span>
                {session.extra && <span className="mcChip tone-live">{t('Make-up')}</span>}
            </div>
            <p className="mcPlace">
                <LuMapPin aria-hidden="true" />
                <span>{place.label || t('No place set')}</span>
            </p>
            {canPick && (
                <div className="mcRooms" role="radiogroup" aria-label={t('Room for this session')} aria-busy={saving !== undefined || undefined}>
                    {options.map((option) => {
                        const checked = option.id === current;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                className={`mcRoom${checked ? ' isOn' : ''}`}
                                disabled={saving !== undefined}
                                onClick={() => !checked && onRoom(option.id)}
                            >
                                <span className="mcRoomName">{option.name}</span>
                                {showRent && <span className="mcRoomRent">{option.rent ? formatVnd(option.rent) : '—'}</span>}
                                {saving === option.id && <Spinner size="sm" color="danger" className="mcRoomSpin" />}
                            </button>
                        );
                    })}
                </div>
            )}
            {note && showRent && <p className="mcFine">{note}</p>}
        </li>
    );
};

export default DaySession;
