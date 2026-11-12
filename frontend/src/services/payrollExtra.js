import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { VENUE_EMBED } from './venues';

// Read-only extras for the payslip dialog (admin), next to services/payroll.js.

const PERSON = 'id, username, full_name, email, avatar_path, updated_at';

// The classes behind a payslip's sessions, with what the session modal and the calendar need:
// the regular instructor (a session taught by someone else is a substitute), room or venue, picture,
// timetable and run. Ended classes too. { [classId]: class }
export async function getPayslipClasses(classIds) {
    const ids = [...new Set(classIds)].filter((id) => id != null);
    if (!ids.length) return {};
    const rows = unwrap(
        await supabase
            .from('classes')
            .select(`id, name, image_path, instructor_id, room_id, venue_id, starts_on, ended_on, final_schedule,
                instructor:profiles!instructor_id(${PERSON}),
                room:rooms!room_id(id, name, size),
                venue:venues!venue_id(${VENUE_EMBED}),
                schedules:class_schedules(id, day_of_week, start_time, end_time)`)
            .in('id', ids)
    );
    return Object.fromEntries(rows.map((row) => [row.id, row]));
}
