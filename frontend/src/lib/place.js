// Where a class or one of its sessions is taught: one of the studio's rooms or a rented studio (venue,
// services/venues.js) and one of that studio's rooms (venue_rooms: every studio has at least one). A session's own
// place comes first (rows that embed `room` / `venue`), then its class's.
//
// Place { kind: 'room' | 'venue' | null, id, name, studio, roomName, address, mapUrl }
//   name      how the place reads (placeLabel): staff and instructors see a rented studio's own name and its
//             room ("Studio Thỏ · Phòng lớn"); visitors and students only its public name ("Đê La Thành nhỏ"),
//             never the studio's own name (that is another studio's brand)
//   studio    the rented studio alone (without the room), e.g. for "Open … in Maps"
//   roomName  the rented studio's room, when one is picked (staff / instructors only)

const NOWHERE = { kind: null, id: null, name: null, studio: null, roomName: null, address: null, mapUrl: null };

// A venue's map link, else a Google Maps search of its address (null without either).
export const mapLinkOf = (venue) =>
    venue?.map_url || (venue?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}` : null);

// How a rented studio reads. `audience` 'staff' (staff, admins, instructors): its own name and the room;
// 'public' (the website, students): its public name only.
export function placeLabel(venue, room, { audience = 'staff' } = {}) {
    if (!venue) return null;
    if (audience === 'public') return venue.public_name ?? null;
    return [venue.name, room?.name].filter(Boolean).join(' · ') || null;
}

const venuePlace = (venue, room, audience) => {
    const isPublic = audience === 'public';
    return {
        kind: 'venue',
        id: venue.id,
        name: placeLabel(venue, room, { audience }),
        studio: isPublic ? venue.public_name ?? null : venue.name ?? null,
        roomName: isPublic ? null : room?.name ?? null,
        address: venue.address ?? null,
        mapUrl: mapLinkOf(venue),
    };
};
const roomPlace = (room) => ({ ...NOWHERE, kind: 'room', id: room.id, name: room.name });

// `row` (a session, or a class) and its class `cls`: the first one that embeds a room or a venue decides (its
// `venue_room` embed is the room at that studio). `audience` as in placeLabel.
export function placeOf(row, cls, { audience = 'staff' } = {}) {
    for (const item of [row, cls]) {
        if (item?.venue) return venuePlace(item.venue, item.venue_room, audience);
        if (item?.room) return roomPlace(item.room);
    }
    return NOWHERE;
}

// A list_public_classes() row: its place's name (room_name: a room's name, or a rented studio's public name),
// which kind it is (place_kind) and, for a rented studio, the address and map link.
export function publicPlaceOf(row) {
    if (!row?.room_name) return NOWHERE;
    if (row.place_kind === 'venue') {
        return venuePlace({ id: null, public_name: row.room_name, address: row.venue_address ?? null, map_url: row.venue_map_url ?? null }, null, 'public');
    }
    return { ...NOWHERE, kind: 'room', name: row.room_name };
}

// The address to show next to the place's name, without repeating it: a public name is often the first part of
// the address ("Bà Triệu" · "Bà Triệu, Hà Nội" → "Hà Nội"). Null when nothing is left.
export function addressAfterName(place) {
    const address = place?.address?.trim();
    if (!address) return null;
    const fold = (text) => text.trim().toLocaleLowerCase('vi');
    const [first, ...rest] = address.split(',');
    if (place.name && fold(first) === fold(place.name)) return rest.join(',').trim() || null;
    return address;
}

// The class's place as one picker key and back to the columns to write:
//   'room:1' (a studio room) · 'vroom:7' (room 7 of a rented studio) · '' (not set). At a rented studio a class is
//   always in one of its rooms; 'venue:3' (the studio alone) only stands for a row without its room, which the
//   server puts in the studio's first room.
export const placeKeyOf = (cls) => {
    if (cls?.venue_room_id) return `vroom:${cls.venue_room_id}`;
    if (cls?.venue_id) return `venue:${cls.venue_id}`;
    return cls?.room_id ? `room:${cls.room_id}` : '';
};

// { roomId, venueId, venueRoomId }: a rented studio's room gives only venueRoomId — the server sets its studio
// (venue_id) from the room.
export function placeColumns(key) {
    const [kind, id] = String(key ?? '').split(':');
    return {
        roomId: kind === 'room' ? Number(id) : null,
        venueId: kind === 'venue' ? Number(id) : null,
        venueRoomId: kind === 'vroom' ? Number(id) : null,
    };
}
