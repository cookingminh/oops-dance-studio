import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Activity log (supabase/migrations/20261117000200_activity_log.sql): who did what in the studio. Admins only.
// Row: { id, at (timestamptz), actor_id (null = the system: a scheduled job, the bank, a sign-up),
//   actor_name, actor_role, area, action, entity (table), entity_id, class_id, subject_id (the person the
//   record is about), label (a guest / class / student / routine title, as it was), meta, changes }.
//
// Areas and their actions (meta keys in brackets):
//   bookings   created · approved · rejected · cancelled · completed · reopened · payment_updated · updated · deleted
//              [room, date, start, end, status]
//              paid · refunded [received (negative = given back), method, bank, note] · payment_removed
//              price_changed [from, to, note]
//              cancelled through cancel_booking also [refund, percent, tier, by_studio, note]
//              refund_changed [refund, note] (booking_set_refund)
//              refund_policy (entity booking_settings, no guest) [full_hours, partial_hours, partial_percent]
//   classes    created · updated · ended [last_day, reason] · reopened · instructor_changed [instructor, from] · deleted
//              schedule_added · schedule_changed · schedule_removed [day (1 = Mon), start, end, from]
//   routines   planned · updated · deleted · video_added · video_changed · video_removed [class, starts_on, sessions, price]
//              promo_added · promo_changed · promo_caption · promo_removed [class, starts_on, seconds, caption]
//   students   enrolled · removed (system = left after their course) · leaving · staying · updated [class, joined_at, leaves_after]
//   sessions   checked_in · checked_out · approved · cancelled · reopened · substituted [from] · note [note]
//              make_up_added · make_up_removed [date, start, make_up, instructor]
//              cancelled through session_cancel / session_move also [reason] (what the class is told)
//              day_closed (entity 'studio', entity_id and meta date, label = the reason; studio_close_day)
//              [date, reason, sessions (called off), bookings (cancelled by the studio)]
//              check_edited (staff corrected the check-in / check-out; session_edit_check, subject = the instructor,
//              label = the class) [date, instructor, reason, start]; changes {checkin_at, checkout_at,
//              checkout_late, status: { from, to }} (only what changed)
//   roll_call  attended · absent · unmarked · note [class, date, status]
//   tuition    paid [received, method] (system = the bank) · payment_undone · waived [note] · reopened · cancelled [reason]
//              (system = the renewal cycle) · amount_changed [from, note] · renewal [renewal: continue|stop] · note
//              [class, course, amount, paid, method, status]
//              transfer_unmatched (system) · transfer_assigned · transfer_ignored · transfer_reopened [amount, student]
//   expenses   created · updated · deleted · receipt_added · receipt_removed [category, amount, spent_on, vendor, class]
//              recurring_created · recurring_updated · recurring_paused · recurring_resumed · recurring_deleted [day]
//   payroll    payslip_finalized · payslip_paid · payslip_unpaid · payslip_reopened [month, total]
//              bonus_added · deduction_added · adjustment_changed · adjustment_removed [month, amount, reason]
//              salary_set · salary_removed [salary, from] · rate_set · rate_removed (label = class) [rate, from]
//   rooms      created · updated · photos_changed · deleted [size, price]
//              venue_added · venue_changed (changes) · venue_removed — a rented studio (entity venues) [rent, address, active,
//              public_name, rooms + rooms_before ([{ name, rent, active }], when its rooms changed)]
//   users      account_created (actor null = signed up themselves) · account_deleted · role_changed [role, from]
//              profile_edited [email, role]
//   settings   updated (label 'Payroll' | 'Tuition'; see changes)
//              timetable_template (entity site_settings, label 'Website') [template, from]
// `changes` (plain edits): { column: { from, to } }.

export const ACTIVITY_AREAS = ['bookings', 'classes', 'routines', 'students', 'sessions', 'roll_call', 'tuition', 'expenses', 'payroll', 'rooms', 'users', 'settings'];

const PAGE_SIZE = 80;

// The log's `search` column is label + actor name in lower case without Vietnamese accents; fold the
// term the same way ("Thảo Vy", "thao vy" → "thao vy"). '' when there is nothing to search.
export function foldSearch(search) {
    return (search ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[%_\\]/g, ' ')
        .trim();
}

// Newest first. Filters: { from, to } (ISO timestamps, `to` exclusive), actorId ('system' = no person),
// areas (array), actions (array), classId, subjectId, search (in label / actor name), before ({ at, id } of the
// last row seen, for "load more"). → { rows, hasMore }.
export async function listActivity({ from, to, actorId, areas, actions, classId, subjectId, search, before, limit = PAGE_SIZE } = {}) {
    let query = supabase.from('activity_log').select('*').order('at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
    if (from) query = query.gte('at', from);
    if (to) query = query.lt('at', to);
    if (actorId === 'system') query = query.is('actor_id', null);
    else if (actorId) query = query.eq('actor_id', actorId);
    if (areas?.length) query = query.in('area', areas);
    if (actions?.length) query = query.in('action', actions);
    if (classId) query = query.eq('class_id', classId);
    if (subjectId) query = query.eq('subject_id', subjectId);
    const term = foldSearch(search);
    if (term) query = query.ilike('search', `%${term}%`);
    if (before) query = query.or(`at.lt."${before.at}",and(at.eq."${before.at}",id.lt.${before.id})`);
    const rows = unwrap(await query);
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
}

// Counts for a period's filters: { total, people: [{ actor_id, name, role, count }], areas: [{ area, count }],
// actions: [{ area, action, count }] }.
export async function getActivitySummary(from, to) {
    return unwrap(await supabase.rpc('activity_summary', { p_from: from, p_to: to }));
}

// Everything that happened to one record (e.g. 'bookings', 42), oldest first.
export async function listEntityActivity(entity, entityId) {
    return unwrap(
        await supabase.from('activity_log').select('*').eq('entity', entity).eq('entity_id', String(entityId)).order('at').order('id')
    );
}
