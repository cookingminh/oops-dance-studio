import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Rented studios (supabase/migrations/20261117001300_venues.sql, api-contract §3 venues): while the studio's
// own rooms are closed, classes are taught in studios rented by the hour. A class is taught in a room
// (classes.room_id) or at a venue (classes.venue_id), never both; its sessions follow it.
//
// Venue { id, name, address, map_url, rent_per_hour, note, active, created_at, updated_at }
// Everyone may read id, name, address, map_url and active; the rent and the note are staff's (venues_list()),
// so never select * on the table.

// Embed for a class or a session: `venue:venues!venue_id(${VENUE_EMBED})`.
export const VENUE_EMBED = 'id, name, address, map_url';

// Staff: every venue with its rent and note, active ones first, then by name.
export async function listVenues() {
    return unwrap(await supabase.rpc('venues_list'));
}

// Staff: add (no id) or change a venue → the venue. Logged in the activity log.
export async function saveVenue(id, { name, address, mapUrl, rent, note, active }) {
    return unwrap(
        await supabase.rpc('venue_save', {
            p_id: id ?? null,
            p_name: name,
            p_address: address?.trim() || null,
            p_map_url: mapUrl?.trim() || null,
            p_rent: Number(rent) || 0,
            p_note: note?.trim() || null,
            p_active: active,
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

// Staff: the classes taught at a venue that haven't ended by `today` → [{ id, name, venue_id }].
export async function listVenueClasses(today) {
    return unwrap(
        await supabase
            .from('classes')
            .select('id, name, venue_id')
            .not('venue_id', 'is', null)
            .or(`ended_on.is.null,ended_on.gte.${today}`)
            .order('name')
    );
}

// The automatic rent rows of a month ('yyyy-MM-01'): [{ amount, venue_id, vendor }] (vendor: the studio's
// name when it was charged). Expenses RLS: only admins see them (they are the system's, not a staff
// member's), so staff get [].
export async function listVenueRent(month) {
    const rows = unwrap(
        await supabase
            .from('expenses')
            .select('amount, vendor, session:instructor_attendance!session_id(venue_id)')
            .eq('category', 'venue_rent')
            .eq('month', month)
            .is('created_by', null)
    );
    return rows.map((row) => ({ amount: Number(row.amount) || 0, venue_id: row.session?.venue_id ?? null, vendor: row.vendor }));
}
