import { supabase } from '@/lib/supabase';
import { AppError, unwrap } from './errors';

const SCHEDULE_COLUMNS = 'id, class_id, day_of_week, start_time, end_time, class:classes!class_id(id, name)';

function rethrowDuplicate(error) {
    if (error.code === 'DUPLICATE') {
        throw new AppError('DUPLICATE', 'This class already has a session that starts at that time on that day.');
    }
    throw error;
}

export async function listSchedules() {
    return unwrap(
        await supabase
            .from('class_schedules')
            .select(SCHEDULE_COLUMNS)
            .order('day_of_week')
            .order('start_time')
    );
}

// day_of_week is ISO: 1 = Monday … 7 = Sunday.
export async function createSchedule({ classId, dayOfWeek, startTime, endTime }) {
    try {
        return unwrap(
            await supabase
                .from('class_schedules')
                .insert({ class_id: classId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
                .select(SCHEDULE_COLUMNS)
                .single()
        );
    } catch (error) {
        return rethrowDuplicate(error);
    }
}

export async function updateSchedule(id, { classId, dayOfWeek, startTime, endTime }) {
    try {
        return unwrap(
            await supabase
                .from('class_schedules')
                .update({ class_id: classId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime })
                .eq('id', id)
                .select(SCHEDULE_COLUMNS)
                .single()
        );
    } catch (error) {
        return rethrowDuplicate(error);
    }
}

export async function deleteSchedule(id) {
    unwrap(await supabase.from('class_schedules').delete().eq('id', id));
}
