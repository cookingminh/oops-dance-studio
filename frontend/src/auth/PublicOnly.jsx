import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '@/ui/feedback/AsyncState';
import { useAuth } from './useAuth';
import { homePathFor } from './roles';

// Login / register: signed-in users are sent back where they came from, or to their home.
export default function PublicOnly() {
    const { loading, isAuthenticated, role, profileError } = useAuth();
    const location = useLocation();

    if (!isAuthenticated || profileError) return <Outlet />;
    if (loading) {
        return (
            <div className="min-h-screen flex items-center">
                <Loading />
            </div>
        );
    }
    const from = location.state?.from;
    const target = from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : homePathFor(role);
    return <Navigate to={target} replace />;
}
