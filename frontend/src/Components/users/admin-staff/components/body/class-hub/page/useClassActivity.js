import { useAsync } from '@/hooks/useAsync';
import { listClassInvoices } from '@/services/tuition';
import { listClassRollCalls, listClassSessions } from '../hubQueries';
import { lastDayOf, nextMonth } from '../hubModel';

// One month of a class: its sessions (with proofs) and roll calls. `version` reloads it.
export function useMonthActivity(classId, month, version) {
    return useAsync(async () => {
        if (!month) return undefined;
        const [sessions, roll] = await Promise.all([
            listClassSessions(classId, month, nextMonth(month)),
            listClassRollCalls(classId, month, lastDayOf(month)),
        ]);
        return { sessions, roll };
    }, [classId, month, version]);
}

// Every invoice of the class (newest course first), or one course's with `lessonId`.
export function useClassInvoices(classId, version, lessonId = null) {
    return useAsync(() => listClassInvoices(classId, lessonId ? { lessonId } : undefined), [classId, version, lessonId]);
}
