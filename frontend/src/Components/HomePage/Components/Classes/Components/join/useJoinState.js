import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useAsync } from '@/hooks/useAsync';
import { getStudioToday } from '@/services/studio';
import { listStudentPlaces } from '@/services/classSwitch';
import { listClosedClassIds, listMyJoinRequests } from '@/services/classJoin';

// Where the viewer stands with each class, loaded once per page (JoinProvider):
//   viewer   'loading' | 'anon' | 'guest' (a student) | 'other' (instructor, staff, admin: no way in)
//   stateOf(classId) → null (not known yet, or nothing to offer) | 'anon' | 'ask' | 'pending' | 'in' | 'closed'
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
    const mine = useAsync(async () => {
        if (!userId) return null;
        const [today, places, requests] = await Promise.all([getStudioToday(), listStudentPlaces(userId), listMyJoinRequests()]);
        return { today, places, pending: requests.filter((row) => row.status === 'pending') };
    }, [userId]);

    const closedIds = closed.data;
    const data = mine.data;
    const stateOf = useCallback(
        (classId) => {
            if (viewer === 'loading' || viewer === 'other' || !closedIds) return null;
            if (closedIds.has(classId)) return 'closed';
            if (viewer === 'anon') return 'anon';
            if (!data) return null;
            const place = data.places.get(classId);
            if (place && (!place.leaves_after || place.leaves_after >= data.today)) return 'in';
            if (data.pending.some((row) => row.class_id === classId)) return 'pending';
            return 'ask';
        },
        [viewer, closedIds, data]
    );
    const pendingOf = useCallback((classId) => data?.pending.find((row) => row.class_id === classId) ?? null, [data]);
    const { reload } = mine;

    return useMemo(
        () => ({ viewer, stateOf, pendingOf, pendingCount: data?.pending.length ?? 0, refresh: reload }),
        [viewer, stateOf, pendingOf, data, reload]
    );
}
