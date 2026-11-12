import { Select, SelectItem, SelectSection } from '@nextui-org/react';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { PlaceIcon } from '@/ui/place/PlaceParts';

const POPOVER = { popoverContent: 'adminPortal' };
const NONE = 'none';

// "Where it's taught": one of the studio's rooms or a rented studio (lib/place.js keys 'room:1' / 'venue:3',
// '' = not set). Rented studios are the active ones, plus the class's own if it was set inactive since.
// Under a rented studio a hint says its rent becomes the class's cost; `roomHint` is what a room shows.
const PlaceField = ({ value, onChange, rooms, venues, isDisabled = false, roomHint }) => {
    const { t } = useI18n();
    const shownVenues = venues.filter((venue) => venue.active || value === `venue:${venue.id}`);
    const venue = value.startsWith('venue:') ? venues.find((item) => `venue:${item.id}` === value) : null;
    const hint = venue
        ? t('Its rent ({rent}/h × each session’s length) is added to the class’s costs after each session.', { rent: formatVnd(venue.rent_per_hour) })
        : roomHint;

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
            startContent={value ? <PlaceIcon place={{ kind: venue ? 'venue' : 'room' }} className="text-default-400" /> : null}
        >
            {[
                rooms.length > 0 && (
                    <SelectSection key="rooms" title={t('Studio rooms')} showDivider>
                        {rooms.map((room) => (
                            <SelectItem key={`room:${room.id}`} textValue={room.name} startContent={<PlaceIcon place={{ kind: 'room' }} className="text-default-400" />}>
                                {room.name}
                            </SelectItem>
                        ))}
                    </SelectSection>
                ),
                shownVenues.length > 0 && (
                    <SelectSection key="venues" title={t('Rented studios')} showDivider>
                        {shownVenues.map((item) => (
                            <SelectItem
                                key={`venue:${item.id}`}
                                textValue={item.name}
                                description={[t('{rent}/h', { rent: formatVnd(item.rent_per_hour) }), item.active ? null : t('Inactive')].filter(Boolean).join(' · ')}
                                startContent={<PlaceIcon place={{ kind: 'venue' }} className="text-default-400" />}
                            >
                                {item.name}
                            </SelectItem>
                        ))}
                    </SelectSection>
                ),
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
