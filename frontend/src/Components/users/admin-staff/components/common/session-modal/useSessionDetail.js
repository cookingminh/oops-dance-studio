import { useAsync } from '@/hooks/useAsync';
import { getMakeUpFor, listClassRollCalls, listClassSessions } from '../../body/class-hub/hubQueries';
import { shiftDay } from './sessionModel';

// One session, fresh: its instructor_attendance row (instructor, signed proof photos, note, why it was
// called off) or null, its roll call (students with their phone) and, for a session called off, the
// make-up that replaces it (or null). `version` reloads it.
export function useSessionDetail(classId, date, version) {
    return useAsync(async () => {
        if (!classId || !date) return undefined;
        const [rows, roll] = await Promise.all([listClassSessions(classId, date, shiftDay(date, 1)), listClassRollCalls(classId, date, date)]);
        const row = rows[0] ?? null;
        const makeUp = row?.status === 'cancelled' ? await getMakeUpFor(classId, date).catch(() => null) : null;
        return { row, roll, makeUp };
    }, [classId, date, version]);
}
