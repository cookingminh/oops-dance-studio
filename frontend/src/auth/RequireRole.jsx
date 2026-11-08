import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@nextui-org/react';
import { Loading } from '@/ui/feedback/AsyncState';
import { useAuth } from './useAuth';
import { homePathFor } from './roles';

function ProfileError({ error, onSignOut }) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 min-h-screen p-6 text-center">
            <p className="text-red-600 font-medium">We couldn’t load your profile: {error.message}</p>
            <Button onPress={onSignOut}>Log out</Button>
        </div>
    );
}

// Renders children only for signed-in users whose profile role is in `roles`.
// Signed-out users go to /login (and come back afterwards); other roles go to their own home.
export default function RequireRole({ roles, children }) {
    const { loading, isAuthenticated, role, profileError, signOut } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center">
                <Loading />
            </div>
        );
    }
    if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
    if (profileError) return <ProfileError error={profileError} onSignOut={signOut} />;
    if (!roles.includes(role)) return <Navigate to={homePathFor(role)} replace />;
    return children ?? <Outlet />;
}
