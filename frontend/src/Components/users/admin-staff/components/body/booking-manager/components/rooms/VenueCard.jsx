import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuGlobe, LuMapPin, LuPencil, LuStickyNote, LuTrash2 } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { mapLinkOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { MapLink } from '@/ui/place/PlaceParts';
import { fadeUp } from '../../../../common/motion';
import { classPath } from '../../../class-hub/hubModel';

const ClassLinks = ({ classes }) => (
    <ul className="venueClassList">
        {classes.map((cls) => (
            <li key={cls.id}>
                <Link to={classPath(cls.id)}>{cls.name}</Link>
            </li>
        ))}
    </ul>
);

// One rented studio: its own name (staff's) and the name the website shows, where it is (address, map link), its
// rent per hour, its rooms with their rents and the classes in each, the classes taught there without a room and —
// for admins, who see the automatic rent rows — the rent charged this month. Edit and delete.
//   classes  [{ id, name, venue_room_id }] taught there now   rent  this month's rent (null: not shown)
const VenueCard = ({ venue, classes, rent, busy, onEdit, onDelete }) => {
    const { t } = useI18n();
    const place = { name: venue.name, mapUrl: mapLinkOf(venue) };
    // Its active rooms, and an inactive one while classes are still in it.
    const rooms = (venue.rooms ?? []).filter((room) => room.active || classes.some((cls) => cls.venue_room_id === room.id));
    const inRoom = (room) => classes.filter((cls) => cls.venue_room_id === room.id);
    const loose = classes.filter((cls) => !cls.venue_room_id || !rooms.some((room) => room.id === cls.venue_room_id));
    const hasRooms = rooms.length > 0;

    return (
        <motion.article variants={fadeUp} className={`venueCard${venue.active ? '' : ' isInactive'}`} data-venue={venue.id}>
            <header className="venueCardHead">
                <span className="venueCardIcon" aria-hidden="true">
                    <LuMapPin />
                </span>
                <span className="venueCardTitle">
                    <h4>{venue.name}</h4>
                    {!venue.active && <span className="venueBadge">{t('Inactive')}</span>}
                </span>
                <span className="venueCardActions">
                    <Button isIconOnly size="sm" variant="light" aria-label={t('Edit {name}', { name: venue.name })} isDisabled={busy} onPress={() => onEdit(venue)}>
                        <LuPencil />
                    </Button>
                    <Button isIconOnly size="sm" variant="light" className="venueDanger" aria-label={t('Delete {name}', { name: venue.name })} isLoading={busy} onPress={() => onDelete(venue)}>
                        <LuTrash2 />
                    </Button>
                </span>
            </header>

            <p className="venuePublic" title={t('Visitors and students see this instead of the studio’s name.')}>
                <LuGlobe aria-hidden="true" />
                <span>{t('On the website')}</span>
                <strong>{venue.public_name}</strong>
            </p>

            <p className="venueWhere">
                {venue.address ? <span>{venue.address}</span> : <span className="venueMuted">{t('No address yet')}</span>}
                <MapLink place={place} />
            </p>

            {hasRooms ? (
                <div className="venueRoomsBlock">
                    <ul className="venueRoomList" aria-label={t('Rooms')}>
                        {rooms.map((room) => (
                            <li key={room.id} className={room.active ? undefined : 'isInactive'} data-room={room.id}>
                                <span className="venueRoomHead">
                                    <strong>{room.name}</strong>
                                    {!room.active && <span className="venueBadge">{t('Inactive')}</span>}
                                    <span className="venueRoomRent">{t('{rent}/h', { rent: formatVnd(room.rent_per_hour) })}</span>
                                </span>
                                {inRoom(room).length > 0 ? <ClassLinks classes={inRoom(room)} /> : <span className="venueMuted">{t('No classes in it')}</span>}
                            </li>
                        ))}
                    </ul>
                    <p className="venueRoomFallback">{t('No room picked: {rent}/h', { rent: formatVnd(venue.rent_per_hour) })}</p>
                </div>
            ) : (
                <div className="venueRent">
                    <strong>{formatVnd(venue.rent_per_hour)}</strong>
                    <span>{t('per hour')}</span>
                </div>
            )}

            <dl className="venueFacts">
                {(!hasRooms || loose.length > 0) && (
                    <div className="isClasses">
                        <dt>{hasRooms ? t('Classes with no room picked') : t('Classes here')}</dt>
                        <dd>{loose.length ? <ClassLinks classes={loose} /> : <span className="venueMuted">{t('None right now')}</span>}</dd>
                    </div>
                )}
                {rent !== null && (
                    <div className="isMoney">
                        <dt>{t('Rent this month')}</dt>
                        <dd>{formatVnd(rent)}</dd>
                    </div>
                )}
            </dl>

            {venue.note && (
                <p className="venueNote">
                    <LuStickyNote aria-hidden="true" />
                    <span>{venue.note}</span>
                </p>
            )}
        </motion.article>
    );
};

export default VenueCard;
