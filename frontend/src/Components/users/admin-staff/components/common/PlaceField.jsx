import { Select, SelectItem, SelectSection } from '@nextui-org/react';
import { formatVnd } from '@/lib/format';
import { placeLabel } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { PlaceIcon } from '@/ui/place/PlaceParts';

const POPOVER = { popoverContent: 'adminPortal' };
const NONE = 'none';

// What the picker offers of the rented studios (services/venues.js listVenues, with their rooms): the active ones,
// plus the class's own place if it was set inactive since. A studio with rooms offers its active rooms (the studio
// alone only while it is the class's place); one without rooms is one option at its own price.
const offerOf = (venues, value) =>
    venues
        .map((venue) => {
            const rooms = (venue.rooms ?? []).filter((room) => room.active || value === `vroom:${room.id}`);
            const shown = venue.active || value === `venue:${venue.id}` || rooms.some((room) => value === `vroom:${room.id}`);
            return shown && { venue, rooms, hasRooms: rooms.length > 0 };
        })
        .filter(Boolean);

// The rented studio (and its room) a picker key points at, or null.
function pickedOf(venues, value) {
    const [kind, id] = value.split(':');
    if (kind === 'venue') {
        const venue = venues.find((item) => String(item.id) === id);
        return venue ? { venue, room: null } : null;
    }
    if (kind !== 'vroom') return null;
    for (const venue of venues) {
        const room = (venue.rooms ?? []).find((item) => String(item.id) === id);
        if (room) return { venue, room };
    }
    return null;
}

// "Where it's taught": one of the studio's rooms, a rented studio or one of its rooms (lib/place.js keys 'room:1' /
// 'venue:3' / 'vroom:7', '' = not set). Under a rented studio a hint says its rent (the room's, else the
// studio's) becomes the class's cost; `roomHint` is what one of the studio's own rooms shows.
const PlaceField = ({ value, onChange, rooms, venues, isDisabled = false, roomHint }) => {
    const { t } = useI18n();
    const offer = offerOf(venues, value);
    const picked = pickedOf(venues, value);
    const perHour = (rent) => t('{rent}/h', { rent: formatVnd(rent) });
    let hint = roomHint;
    if (picked?.room) {
        hint = t('The room’s rent ({rent}/h × each session’s length) is added to the class’s costs after each session.', { rent: formatVnd(picked.room.rent_per_hour) });
    } else if (picked) {
        hint = t('Its rent ({rent}/h × each session’s length) is added to the class’s costs after each session.', { rent: formatVnd(picked.venue.rent_per_hour) });
    }
    const icon = (kind) => <PlaceIcon place={{ kind }} className="text-default-400" />;
    const inactive = (item) => (item.active ? null : t('Inactive'));

    // A studio without rooms: one option.
    const studioItem = ({ venue }) => (
        <SelectItem key={`venue:${venue.id}`} textValue={venue.name} description={[perHour(venue.rent_per_hour), inactive(venue)].filter(Boolean).join(' · ')} startContent={icon('venue')}>
            {venue.name}
        </SelectItem>
    );
    // A studio with rooms: its own section, a room per option; the studio alone only while the class is there.
    const roomsSection = ({ venue, rooms: venueRooms }) => (
        <SelectSection key={`v${venue.id}`} title={[venue.name, inactive(venue)].filter(Boolean).join(' · ')} showDivider>
            {[
                value === `venue:${venue.id}` && (
                    <SelectItem
                        key={`venue:${venue.id}`}
                        textValue={venue.name}
                        description={t('The studio’s price: {rent}', { rent: perHour(venue.rent_per_hour) })}
                        startContent={icon('venue')}
                    >
                        {t('No room picked')}
                    </SelectItem>
                ),
                ...venueRooms.map((room) => (
                    <SelectItem
                        key={`vroom:${room.id}`}
                        textValue={placeLabel(venue, room)}
                        description={[perHour(room.rent_per_hour), inactive(room)].filter(Boolean).join(' · ')}
                        startContent={icon('venue')}
                    >
                        {room.name}
                    </SelectItem>
                )),
            ].filter(Boolean)}
        </SelectSection>
    );

    const single = offer.filter((item) => !item.hasRooms);
    return (
        <Select
            label={t('Where it’s taught')}
            classNames={POPOVER}
            isDisabled={isDisabled}
            placeholder={t('Not set')}
            selectedKeys={[value || NONE]}
            disallowEmptySelection
            onChange={(event) => onChange(event.target.value === NONE ? '' : event.target.value)}
            description={hint}
            startContent={value ? icon(picked ? 'venue' : 'room') : null}
        >
            {[
                rooms.length > 0 && (
                    <SelectSection key="rooms" title={t('Studio rooms')} showDivider>
                        {rooms.map((room) => (
                            <SelectItem key={`room:${room.id}`} textValue={room.name} startContent={icon('room')}>
                                {room.name}
                            </SelectItem>
                        ))}
                    </SelectSection>
                ),
                single.length > 0 && (
                    <SelectSection key="venues" title={t('Rented studios')} showDivider>
                        {single.map(studioItem)}
                    </SelectSection>
                ),
                ...offer.filter((item) => item.hasRooms).map(roomsSection),
                <SelectSection key="none">
                    <SelectItem key={NONE} textValue={t('Not set')}>
                        {t('Not set')}
                    </SelectItem>
                </SelectSection>,
            ].filter(Boolean)}
        </Select>
    );
};

export default PlaceField;
