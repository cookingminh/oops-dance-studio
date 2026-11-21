import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { getStudioToday } from './studio';

// Join requests, the staff side (supabase/migrations/20261117002500_class_join_requests.sql): students ask to join a
// class (class_join_request), staff approve (class_join_approve → a class_students row, billed and put on the roll call
// by its triggers) or decline (class_join_decline, with a reason the student sees). RLS: staff and admins read every
// request; nobody writes the table except through the RPCs.

// How long answered requests stay on the "Answered" tab.
export const ANSWERED_DAYS = 30;

const PERSON = 'id, username, full_name, email, contact_number, avatar_path, updated_at';
const CLASS = `id, name, level, starts_on, ended_on, image_path, image_pos_x, image_pos_y,
    instructor:profiles!instructor_id(id, username, full_name, avatar_path, updated_at),
    schedules:class_schedules(id, day_of_week, start_time, end_time)`;
const REQUEST = `id, class_id, student_id, status, start_pref, note, decided_by, decided_at, decline_reason, joined_at, created_at, updated_at,
    student:profiles!class_join_requests_student_id_fkey(${PERSON}),
    decider:profiles!class_join_requests_decided_by_fkey(full_name, username),
    class:classes!class_id(${CLASS})`;

// The classes each student is in now and was in before, for "New to the studio" / "Also in Kpop 1" on a request:
// Map(student id → { current: [{ id, name }], past: [{ id, name }] }). Now = a place in a class that hasn't ended and
// that they haven't left; before = an ended class or a place they left, and the classes they were billed for (the
// daily job takes students out of an ended class, so its invoices are what remembers them).
async function studentClasses(studentIds, today) {
    if (studentIds.length === 0) return new Map();
    const [places, invoices] = await Promise.all([
        supabase.from('class_students').select('student_id, class_id, leaves_after, class:classes!class_id(id, name, ended_on)').in('student_id', studentIds).then(unwrap),
        supabase.from('tuition_invoices').select('student_id, class_id, class_name').in('student_id', studentIds).neq('status', 'void').then(unwrap),
    ]);
    const byStudent = new Map(studentIds.map((id) => [id, { current: new Map(), past: new Map() }]));
    for (const place of places) {
        const entry = byStudent.get(place.student_id);
        if (!entry || !place.class) continue;
        const ended = place.class.ended_on && place.class.ended_on < today;
        const left = place.leaves_after && place.leaves_after < today;
        (ended || left ? entry.past : entry.current).set(place.class_id, { id: place.class_id, name: place.class.name });
    }
    for (const invoice of invoices) {
        const entry = byStudent.get(invoice.student_id);
        const key = invoice.class_id ?? `name:${invoice.class_name}`;
        if (!entry || !invoice.class_name || entry.current.has(key)) continue;
        if (!entry.past.has(key)) entry.past.set(key, { id: invoice.class_id, name: invoice.class_name });
    }
    return new Map([...byStudent].map(([id, { current, past }]) => [id, { current: [...current.values()], past: [...past.values()].filter((cls) => !current.has(cls.id)) }]));
}

// Requests with their student, class and who answered:
//   status 'pending'   waiting, oldest first;
//   status 'answered'  approved, declined or cancelled in the last ANSWERED_DAYS days, newest answer first.
// `classId` narrows to one class. Each row also gets `classes` = { current, past } (see studentClasses), not counting
// the class asked for.
export async function listJoinRequests({ status = 'pending', classId } = {}) {
    const today = await getStudioToday();
    let query = supabase.from('class_join_requests').select(REQUEST);
    if (status === 'pending') {
        query = query.eq('status', 'pending').order('created_at', { ascending: true });
    } else {
        const since = new Date(Date.now() - ANSWERED_DAYS * 24 * 60 * 60 * 1000).toISOString();
        query = query.in('status', ['approved', 'declined', 'cancelled']).gte('decided_at', since).order('decided_at', { ascending: false });
    }
    if (classId) query = query.eq('class_id', classId);
    const rows = unwrap(await query);
    const classes = await studentClasses([...new Set(rows.map((row) => row.student_id))], today);
    return rows.map((row) => {
        const theirs = classes.get(row.student_id) ?? { current: [], past: [] };
        const others = (list) => list.filter((cls) => cls.id !== row.class_id);
        return { ...row, classes: { current: others(theirs.current), past: theirs.past } };
    });
}

// What the bell needs: every waiting request, oldest first → [{ id, class_id, student_id, created_at, class: { name }, student }].
export async function listWaitingJoinRequests() {
    return unwrap(
        await supabase
            .from('class_join_requests')
            .select('id, class_id, student_id, created_at, class:classes!class_id(name), student:profiles!class_join_requests_student_id_fkey(full_name, username)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
    );
}

export async function countPendingJoinRequests() {
    const { count, error } = await supabase.from('class_join_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    if (error) throw error;
    return count ?? 0;
}

// The classes the page's filter offers: every class that hasn't ended → [{ id, name, level }] by name.
export async function listJoinClasses() {
    const today = await getStudioToday();
    return unwrap(await supabase.from('classes').select('id, name, level').or(`ended_on.is.null,ended_on.gte.${today}`).order('name'));
}

// Approve: `from` 'now' (the running course, billed like addStudent: in full unless late joins are pro-rated) or
// 'next' (from the next course's first day, paid in full); null = what the student asked for. → the request row
// (joined_at = their start).
export async function approveJoinRequest(id, from = null) {
    return unwrap(await supabase.rpc('class_join_approve', { p_request: id, p_from: from }));
}

// Decline, with an optional reason (≤ 300 characters) the student sees. → the request row.
export async function declineJoinRequest(id, reason = null) {
    return unwrap(await supabase.rpc('class_join_decline', { p_request: id, p_reason: reason?.trim() || null }));
}
