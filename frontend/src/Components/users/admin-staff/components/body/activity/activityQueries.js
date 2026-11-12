import { supabase } from '@/lib/supabase';
import { unwrap } from '@/services/errors';
import { foldSearch } from '@/services/activity';

// Read-only lookups for the Activity page (admins read every profile, room, rented studio and class):
// avatars and current roles for the people in the log, and names for ids in "what changed".
export async function loadLookups() {
    const [profiles, rooms, venues, venueLog, classes, members] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, email, role, avatar_path, updated_at'),
        supabase.from('rooms').select('id, name'),
        supabase.from('venues').select('id, name'),
        // A rented studio deleted since keeps its name in its own log rows.
        supabase.from('activity_log').select('entity_id, label').eq('entity', 'venues').order('id'),
        supabase.from('classes').select('id, name'),
        supabase.from('class_students').select('student_id'),
    ]);
    const students = new Set(unwrap(members).map((row) => row.student_id));
    const people = new Map(
        unwrap(profiles).map((person) => [
            person.id,
            {
                ...person,
                name: person.full_name?.trim() || person.username || person.email || '',
                // A guest enrolled in a class is shown as a Student (same rule as the People page).
                kind: person.role === 'guest' && students.has(person.id) ? 'student' : person.role,
            },
        ])
    );
    return {
        people,
        rooms: new Map(unwrap(rooms).map((room) => [room.id, room.name])),
        venues: new Map([
            ...unwrap(venueLog).map((row) => [Number(row.entity_id), row.label]),
            ...unwrap(venues).map((venue) => [venue.id, venue.name]),
        ]),
        classes: new Map(unwrap(classes).map((cls) => [cls.id, cls.name])),
    };
}

// How many entries match the feed's filters (listActivity's arguments, without paging): the
// Timeline says it when filters narrow the period.
export async function countActivity({ from, to, actorId, areas, actions, classId, subjectId, search }) {
    let query = supabase.from('activity_log').select('id', { count: 'exact', head: true });
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
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
}
