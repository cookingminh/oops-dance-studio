import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useAsync } from '@/hooks/useAsync';
import { getStudioToday } from '@/services/studio';
import { listStudentPlaces } from '@/services/classSwitch';
import { listClassSeats, listClosedClassIds, listMyJoinRequests } from '@/services/classJoin';

// Where the viewer stands with each class, loaded once per page (JoinProvider):
//   viewer   'loading' | 'anon' | 'guest' (a student) | 'other' (instructor, staff, admin: no way in)
//   stateOf(classId) → null (not known yet, or nothing to offer) | 'anon' | 'ask' | 'pending' | 'in' | 'closed' | 'full'
//     ('full': every place is taken — nobody can ask; a student already in or waiting keeps 'in' / 'pending')
//   seatsOf(classId) → { max, taken, left, full } for a class with a maximum, else null (no limit)
//   pendingOf(classId) → their waiting request for it; pendingCount; refresh() after a request or a cancel.
export function useJoinState() {
    const { user, role, isAuthenticated, loading } = useAuth();
    let viewer = 'other';
    if (loading) viewer = 'loading';
    else if (!isAuthenticated) viewer = 'anon';
    else if (role === ROLES.guest) viewer = 'guest';
    const userId = viewer === 'guest' ? user?.id : null;

    // Classes with a last day take nobody new.
    const closed = useAsync(() => listClosedClassIds().catch(() => new Set()), []);
    // Places left in the classes that have a maximum.
    const seats = useAsync(() => listClassSeats().catch(() => new Map()), []);
    const mine = useAsync(async () => {
        if (!userId) return null;
        const [today, places, requests] = await Promise.all([getStudioToday(), listStudentPlaces(userId), listMyJoinRequests()]);
        return { today, places, pending: requests.filter((row) => row.status === 'pending') };
    }, [userId]);

    const closedIds = closed.data;
    const seatMap = seats.data;
    const data = mine.data;
    const stateOf = useCallback(
        (classId) => {
            if (viewer === 'loading' || viewer === 'other' || !closedIds) return null;
            if (closedIds.has(classId)) return 'closed';
            const full = Boolean(seatMap?.get(classId)?.full);
            if (viewer === 'anon') return full ? 'full' : 'anon';
            if (!data) return null;
            const place = data.places.get(classId);
            if (place && (!place.leaves_after || place.leaves_after >= data.today)) return 'in';
            if (data.pending.some((row) => row.class_id === classId)) return 'pending';
            return full ? 'full' : 'ask';
        },
        [viewer, closedIds, seatMap, data]
    );
    const seatsOf = useCallback((classId) => seatMap?.get(classId) ?? null, [seatMap]);
    const pendingOf = useCallback((classId) => data?.pending.find((row) => row.class_id === classId) ?? null, [data]);
    const { reload } = mine;
    const reloadSeats = seats.reload;
    const refresh = useCallback(() => Promise.all([reload(), reloadSeats()]), [reload, reloadSeats]);

    return useMemo(
        () => ({ viewer, stateOf, seatsOf, pendingOf, pendingCount: data?.pending.length ?? 0, refresh }),
        [viewer, stateOf, seatsOf, pendingOf, data, refresh]
    );
}
