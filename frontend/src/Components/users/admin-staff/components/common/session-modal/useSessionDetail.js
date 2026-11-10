import { useAsync } from '@/hooks/useAsync';
import { listClassRollCalls, listClassSessions } from '../../body/class-hub/hubQueries';
import { shiftDay } from './sessionModel';

// One session, fresh: its instructor_attendance row (instructor, signed proof photos, note) or null,
// and its roll call (students with their phone). `version` reloads it.
export function useSessionDetail(classId, date, version) {
    return useAsync(async () => {
        if (!classId || !date) return undefined;
        const [rows, roll] = await Promise.all([listClassSessions(classId, date, shiftDay(date, 1)), listClassRollCalls(classId, date, date)]);
        return { row: rows[0] ?? null, roll };
    }, [classId, date, version]);
}
