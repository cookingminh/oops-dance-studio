import { LuDoorOpen, LuExternalLink, LuMapPin } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import './place.scss';

// Where a class is taught (lib/place.js Place), shown the same way in the workspace, the instructor's and
// student's pages and on the public site.

// A door for one of the studio's rooms, a pin for a rented studio.
export const PlaceIcon = ({ place, className }) => {
    const Icon = place?.kind === 'venue' ? LuMapPin : LuDoorOpen;
    return <Icon aria-hidden="true" className={className} />;
};

// "Open in Maps" (a new tab) for a rented studio with a map link or an address. `compact`: the icon only.
export const MapLink = ({ place, compact = false, className = '' }) => {
    const { t } = useI18n();
    if (!place?.mapUrl) return null;
    const label = t('Open {name} in Maps', { name: place.name });
    return (
        <a
            className={`placeMapLink${compact ? ' isCompact' : ''} ${className}`.trim()}
            href={place.mapUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            title={label}
            onClick={(event) => event.stopPropagation()}
        >
            {!compact && <span>{t('Open in Maps')}</span>}
            <LuExternalLink aria-hidden="true" />
        </a>
    );
};

// The place's name; a rented studio adds its address and the map link (on their own line when `stacked`).
// `empty`: what to say when the class has no place.
export const PlaceDetails = ({ place, empty = null, stacked = false }) => (
    <span className={`placeDetails${stacked ? ' isStacked' : ''}`}>
        <span className="placeName">{place?.name ?? empty}</span>
        {(place?.address || place?.mapUrl) && (
            <span className="placeWhere">
                {place.address && <span className="placeAddress">{place.address}</span>}
                <MapLink place={place} />
            </span>
        )}
    </span>
);
