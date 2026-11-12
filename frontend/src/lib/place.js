// Where a class or one of its sessions is taught: one of the studio's rooms or a rented studio (venue,
// services/venues.js). A session's own place comes first (rows that embed `room` / `venue`), then its class's.
//
// Place { kind: 'room' | 'venue' | null, id, name, address, mapUrl }

const NOWHERE = { kind: null, id: null, name: null, address: null, mapUrl: null };

// A venue's map link, else a Google Maps search of its address (null without either).
export const mapLinkOf = (venue) =>
    venue?.map_url || (venue?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}` : null);

const venuePlace = (venue) => ({ kind: 'venue', id: venue.id, name: venue.name, address: venue.address ?? null, mapUrl: mapLinkOf(venue) });
const roomPlace = (room) => ({ kind: 'room', id: room.id, name: room.name, address: null, mapUrl: null });

// `row` (a session, or a class) and its class `cls`: the first one that embeds a room or a venue decides.
export function placeOf(row, cls) {
    for (const item of [row, cls]) {
        if (item?.venue) return venuePlace(item.venue);
        if (item?.room) return roomPlace(item.room);
    }
    return NOWHERE;
}

// A list_public_classes() row: its place's name (room_name), which kind it is (place_kind) and, for a venue,
// the address and map link.
export function publicPlaceOf(row) {
    if (!row?.room_name) return NOWHERE;
    if (row.place_kind === 'venue') {
        return venuePlace({ id: null, name: row.room_name, address: row.venue_address ?? null, map_url: row.venue_map_url ?? null });
    }
    return { ...NOWHERE, kind: 'room', name: row.room_name };
}

// The class's place as one picker key ('room:1' / 'venue:3' / '') and back to the columns to write.
export const placeKeyOf = (cls) => (cls?.venue_id ? `venue:${cls.venue_id}` : cls?.room_id ? `room:${cls.room_id}` : '');

export function placeColumns(key) {
    const [kind, id] = String(key ?? '').split(':');
    return { roomId: kind === 'room' ? Number(id) : null, venueId: kind === 'venue' ? Number(id) : null };
}
