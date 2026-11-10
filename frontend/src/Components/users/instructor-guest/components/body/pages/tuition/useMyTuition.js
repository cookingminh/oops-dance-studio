import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { forgetMyTuition, loadMyTuition } from '@/services/tuitionStudent';

// The signed-in student's tuition ({ today, invoices, settings, sandbox }) for the small views
// (overview card, class line); `fresh` skips the short-lived cache (the tuition page itself).
// `refresh()` drops the cache and loads again, after a payment or a renewal answer.
export function useMyTuition({ fresh = false } = {}) {
    const { user } = useAuth();
    const state = useAsync(() => loadMyTuition(user.id, { fresh }), [user.id, fresh]);
    const refresh = () => {
        forgetMyTuition();
        return state.reload();
    };
    return { ...state, refresh };
}
