import { Select, SelectItem, SelectSection } from '@nextui-org/react';
import { formatVnd } from '@/lib/format';
import { placeLabel } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { PlaceIcon } from '@/ui/place/PlaceParts';

const POPOVER = { popoverContent: 'adminPortal' };
const NONE = 'none';

// What the picker offers of the rented studios (services/venues.js listVenues, with their rooms): the active ones and
// their active rooms, plus the class's own room if it (or its studio) was set inactive since. A class at a studio is
// always in one of its rooms (the rent lives on the rooms).
const offerOf = (venues, value) =>
    venues
        .map((venue) => {
            const rooms = (venue.rooms ?? []).filter((room) => room.active || value === `vroom:${room.id}`);
            const shown = venue.active || rooms.some((room) => value === `vroom:${room.id}`);
            return shown && rooms.length > 0 && { venue, rooms };
        })
        .filter(Boolean);

// The rented studio and its room a picker key points at, or null.
function pickedOf(venues, value) {
    const [kind, id] = value.split(':');
    if (kind !== 'vroom') return null;
    for (const venue of venues) {
        const room = (venue.rooms ?? []).find((item) => String(item.id) === id);
        if (room) return { venue, room };
    }
    return null;
}

// "Where it's taught": one of the studio's rooms or a room of a rented studio (lib/place.js keys 'room:1' /
// 'vroom:7', '' = not set). A rented studio with one room is one option ("Bà Triệu", its room and price); one with
// several lists them under its name. Under a rented studio's room a hint says its rent becomes the class's cost;
// `roomHint` is what one of the studio's own rooms shows.
const PlaceField = ({ value, onChange, rooms, venues, isDisabled = false, roomHint }) => {
    const { t } = useI18n();
    const offer = offerOf(venues, value);
    const picked = pickedOf(venues, value);
    const perHour = (rent) => t('{rent}/h', { rent: formatVnd(rent) });
    const hint = picked
        ? t('The room’s rent ({rent}/h × each session’s length) is added to the class’s costs after each session.', { rent: formatVnd(picked.room.rent_per_hour) })
        : roomHint;
    const icon = (kind) => <PlaceIcon place={{ kind }} className="text-default-400" />;
    const inactive = (item) => (item.active ? null : t('Inactive'));

    // A studio with one room: one option, "Bà Triệu" with "Phòng 1 · 250.000 ₫/h".
    const studioItem = ({ venue, rooms: [room] }) => (
        <SelectItem
            key={`vroom:${room.id}`}
            textValue={placeLabel(venue, room)}
            description={[room.name, perHour(room.rent_per_hour), inactive(venue) ?? inactive(room)].filter(Boolean).join(' · ')}
            startContent={icon('venue')}
        >
            {venue.name}
        </SelectItem>
    );
    // A studio with several rooms: its own section, a room per option.
    const roomsSection = ({ venue, rooms: venueRooms }) => (
        <SelectSection key={`v${venue.id}`} title={[venue.name, inactive(venue)].filter(Boolean).join(' · ')} showDivider>
            {venueRooms.map((room) => (
                <SelectItem
                    key={`vroom:${room.id}`}
                    textValue={placeLabel(venue, room)}
                    description={[perHour(room.rent_per_hour), inactive(room)].filter(Boolean).join(' · ')}
                    startContent={icon('venue')}
                >
                    {room.name}
                </SelectItem>
            ))}
        </SelectSection>
    );

    const single = offer.filter((item) => item.rooms.length === 1);
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
                ...offer.filter((item) => item.rooms.length > 1).map(roomsSection),
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
