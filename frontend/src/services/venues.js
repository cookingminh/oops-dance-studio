import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Rented studios (supabase/migrations/20261117001300_venues.sql, 20261117001800_venue_rooms.sql, api-contract §3
// venues): while the studio's own rooms are closed, classes are taught in studios rented by the hour. A class is
// taught in a room (classes.room_id) or at a venue (classes.venue_id), never both; at a venue always in one of its
// rooms (classes.venue_room_id: the server puts it in the first one when none is picked); its sessions follow it.
//
// Venue { id, name, public_name, address, map_url, rent_per_hour, note, active, created_at, updated_at,
//         rooms: [VenueRoom] (listVenues) }
// VenueRoom { id, venue_id, name, rent_per_hour, active, position }
// Every venue has at least one active room and the rent lives on the rooms: venues.rent_per_hour only mirrors the
// first active room's (for older readers), so never show it as the studio's own price.
// `name` is the studio's own (another studio's brand): the app shows it to staff, instructors and admins; the
// website and students see `public_name` (its area, e.g. "Bà Triệu"). Visitors can't read `name` at all.
// Everyone signed in may read id, name, public_name, address, map_url and active, and a room's id, venue_id, name,
// active and position; the rents and the note are staff's (venues_list(), venue_rooms_list()), so never select *.

// Embed for a class or a session: `venue:venues!venue_id(${VENUE_EMBED})`, with its room
// `venue_room:venue_rooms!venue_room_id(${VENUE_ROOM_EMBED})`.
export const VENUE_EMBED = 'id, name, public_name, address, map_url';
export const VENUE_ROOM_EMBED = 'id, name';
// A class's or a session's whole place, embedded: one of the studio's rooms, or a rented studio and its room.
export const PLACE_EMBEDS = `room:rooms!room_id(id, name), venue:venues!venue_id(${VENUE_EMBED}),
    venue_room:venue_rooms!venue_room_id(${VENUE_ROOM_EMBED})`;

// Staff: every rented studio's rooms with their rents, by studio, in the studio's order.
export async function listVenueRooms() {
    return unwrap(await supabase.rpc('venue_rooms_list'));
}

// Staff: every venue with its rent, note and rooms (in order, inactive ones too), active venues first, then by name.
export async function listVenues() {
    const [venues, rooms] = await Promise.all([supabase.rpc('venues_list').then(unwrap), listVenueRooms()]);
    return venues.map((venue) => ({ ...venue, rooms: rooms.filter((room) => room.venue_id === venue.id) }));
}

// Staff: add (no id) or change a venue → the venue. Logged in the activity log.
//   publicName  the name on the website ('' = the first part of the address)
//   rooms       the whole ordered list of its rooms [{ id?, name, rent, active? }], at least one active
//               (INVALID_INPUT otherwise); undefined = leave them as they are. Rooms left out are deleted, or set
//               inactive when a class or a session was in them.
//   rent        only without `rooms`: the price of the "Phòng 1" a venue without rooms gets (with `rooms`, the
//               first active room's rent is sent)
export async function saveVenue(id, { name, publicName, address, mapUrl, rent, note, active, rooms }) {
    const firstRoom = rooms?.find((room) => room.active ?? true);
    return unwrap(
        await supabase.rpc('venue_save', {
            p_id: id ?? null,
            p_name: name,
            p_address: address?.trim() || null,
            p_map_url: mapUrl?.trim() || null,
            p_rent: Number(firstRoom ? firstRoom.rent : rent) || 0,
            p_note: note?.trim() || null,
            p_active: active,
            p_public_name: publicName?.trim() || null,
            p_rooms: rooms
                ? rooms.map((room) => ({ ...(room.id ? { id: room.id } : {}), name: room.name.trim(), rent: Number(room.rent) || 0, active: room.active ?? true }))
                : null,
        })
    );
}

// Staff: remove a venue nobody ever taught at (INVALID_STATE otherwise: set it inactive instead).
export async function deleteVenue(id) {
    unwrap(await supabase.rpc('venue_delete', { p_id: id }));
}

// Staff: charge the rent of every session at a venue that has ended and has none yet → how many were
// charged (the nightly job does the same).
export async function runVenueRent() {
    return unwrap(await supabase.rpc('venue_rent_run'));
}

// Staff: the classes taught at a venue that haven't ended by `today` → [{ id, name, venue_id, venue_room_id }].
export async function listVenueClasses(today) {
    return unwrap(
        await supabase
            .from('classes')
            .select('id, name, venue_id, venue_room_id')
            .not('venue_id', 'is', null)
            .or(`ended_on.is.null,ended_on.gte.${today}`)
            .order('name')
    );
}

// The automatic rent rows of a month ('yyyy-MM-01'): [{ amount, venue_id, venue_room_id, vendor }] (vendor: the
// studio's name when it was charged, "Studio · Room" in a room). Expenses RLS: only admins see them (they are
// the system's, not a staff member's), so staff get [].
export async function listVenueRent(month) {
    const rows = unwrap(
        await supabase
            .from('expenses')
            .select('amount, vendor, session:instructor_attendance!session_id(venue_id, venue_room_id)')
            .eq('category', 'venue_rent')
            .eq('month', month)
            .is('created_by', null)
    );
    return rows.map((row) => ({
        amount: Number(row.amount) || 0,
        venue_id: row.session?.venue_id ?? null,
        venue_room_id: row.session?.venue_room_id ?? null,
        vendor: row.vendor,
    }));
}
