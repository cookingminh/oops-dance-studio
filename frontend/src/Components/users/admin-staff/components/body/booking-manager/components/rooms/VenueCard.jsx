import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuMapPin, LuPencil, LuStickyNote, LuTrash2 } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { mapLinkOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { MapLink } from '@/ui/place/PlaceParts';
import { fadeUp } from '../../../../common/motion';
import { classPath } from '../../../class-hub/hubModel';

// One rented studio: where it is (address, map link), its rent per hour, which classes are taught there
// and — for admins, who see the automatic rent rows — the rent charged this month. Edit and delete.
//   classes  [{ id, name }] taught there now   rent  this month's rent (null: not shown)
const VenueCard = ({ venue, classes, rent, busy, onEdit, onDelete }) => {
    const { t } = useI18n();
    const place = { name: venue.name, mapUrl: mapLinkOf(venue) };

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

            <p className="venueWhere">
                {venue.address ? <span>{venue.address}</span> : <span className="venueMuted">{t('No address yet')}</span>}
                <MapLink place={place} />
            </p>

            <div className="venueRent">
                <strong>{formatVnd(venue.rent_per_hour)}</strong>
                <span>{t('per hour')}</span>
            </div>

            <dl className="venueFacts">
                <div className="isClasses">
                    <dt>{t('Classes here')}</dt>
                    <dd>
                        {classes.length ? (
                            <ul className="venueClassList">
                                {classes.map((cls) => (
                                    <li key={cls.id}>
                                        <Link to={classPath(cls.id)}>{cls.name}</Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <span className="venueMuted">{t('None right now')}</span>
                        )}
                    </dd>
                </div>
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
