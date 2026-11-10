import { supabase } from '@/lib/supabase';
import { isoWeekdayOf } from '@/lib/format';
import { unwrap } from './errors';

// Make-up sessions: instructor_attendance rows with `is_extra` and their own start_time / end_time
// (supabase/migrations/20261115000100_routines.sql). Read-only helpers for the routines panel, the
// check-in pages and the class views. RLS: staff read every row, an instructor their own.

const OWN_TIMES = 'id, start_time, end_time, is_extra';

// Adds `is_extra`, `start_time` and `end_time` to instructor_attendance rows (the shared selects in
// services/attendance.js don't carry them). A row with its own times also gets them as its class's
// slot for that day, so helpers that read times from the weekly schedule show them as well.
export async function withOwnTimes(rows) {
    if (!rows?.length) return rows ?? [];
    let own = rows.filter((row) => row.start_time);
    if (!rows.every((row) => 'start_time' in row)) {
        const dates = rows.map((row) => row.date).sort();
        own = unwrap(
            await supabase
                .from('instructor_attendance')
                .select(OWN_TIMES)
                .not('start_time', 'is', null)
                .gte('date', dates[0])
                .lte('date', dates.at(-1))
        );
    }
    const byId = new Map(own.map((row) => [row.id, row]));
    return rows.map((row) => {
        const times = byId.get(row.id);
        if (!times) return { is_extra: false, start_time: null, end_time: null, ...row };
        const slot = { id: `own-${row.id}`, day_of_week: isoWeekdayOf(row.date), start_time: times.start_time, end_time: times.end_time };
        return { ...row, ...times, class: row.class ? { ...row.class, schedules: [slot] } : row.class };
    });
}

// Make-up sessions and cancelled sessions of one class, oldest first:
// { makeUps: [{ id, date, status, start_time, end_time, details }], cancelledDates: ['yyyy-MM-dd'] }.
export async function listClassSessionChanges(classId) {
    const rows = unwrap(
        await supabase
            .from('instructor_attendance')
            .select('id, date, status, start_time, end_time, is_extra, details')
            .eq('class_id', classId)
            .or('is_extra.eq.true,status.eq.cancelled')
            .order('date')
    );
    return {
        makeUps: rows.filter((row) => row.is_extra && row.status !== 'cancelled'),
        cancelledDates: rows.filter((row) => row.status === 'cancelled').map((row) => row.date),
    };
}

// Make-up sessions of these classes between `from` and `until` (inclusive), not cancelled.
export async function listMakeUpSessions(classIds, { from, until } = {}) {
    if (!classIds.length) return [];
    let query = supabase
        .from('instructor_attendance')
        .select('id, class_id, date, status, start_time, end_time, details')
        .in('class_id', classIds)
        .eq('is_extra', true)
        .neq('status', 'cancelled')
        .order('date');
    if (from) query = query.gte('date', from);
    if (until) query = query.lte('date', until);
    return unwrap(await query);
}
