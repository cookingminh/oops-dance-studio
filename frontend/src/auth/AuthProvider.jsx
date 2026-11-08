import { useCallback, useEffect, useMemo, useState } from 'react';
import { openedFromRecoveryLink } from '@/lib/supabase';
import { getSession, onAuthChange, signOut as signOutRequest } from '@/services/auth';
import { getProfile } from '@/services/users';
import { avatarUrl } from '@/services/storage';
import { toAppError } from '@/services/errors';
import { AuthContext } from './authContext';

// The session comes from Supabase Auth; the role always comes from the user's `profiles` row.
export function AuthProvider({ children }) {
    const [session, setSession] = useState(undefined); // undefined = not resolved yet
    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [recovering, setRecovering] = useState(openedFromRecoveryLink);
    const userId = session?.user?.id ?? null;

    useEffect(() => {
        let active = true;
        getSession()
            .then((current) => active && setSession(current))
            .catch(() => active && setSession(null));

        // Keep this callback synchronous: supabase-js warns against awaiting its API inside it.
        const unsubscribe = onAuthChange((event, nextSession) => {
            if (event === 'PASSWORD_RECOVERY') setRecovering(true);
            if (event === 'SIGNED_OUT') setRecovering(false);
            setSession(nextSession ?? null);
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        setProfileError(null);
        if (!userId) {
            setProfile(null);
            return undefined;
        }
        let active = true;
        getProfile(userId)
            .then((row) => active && setProfile(row))
            .catch((error) => active && setProfileError(toAppError(error)));
        return () => {
            active = false;
        };
    }, [userId]);

    const refreshProfile = useCallback(async () => {
        if (!userId) return null;
        const row = await getProfile(userId);
        setProfile(row);
        return row;
    }, [userId]);

    const signOut = useCallback(async () => {
        await signOutRequest();
        setProfile(null);
    }, []);

    const value = useMemo(() => {
        const user = profile && profile.id === userId
            ? { ...profile, avatar_url: avatarUrl(profile.avatar_path, profile.updated_at) }
            : null;
        return {
            session,
            user,
            role: user?.role ?? null,
            isAuthenticated: Boolean(session),
            // True until we know whether there is a session and, if so, have its profile.
            loading: session === undefined || (Boolean(userId) && !user && !profileError),
            profileError,
            recovering,
            finishRecovery: () => setRecovering(false),
            refreshProfile,
            signOut,
        };
    }, [session, userId, profile, profileError, recovering, refreshProfile, signOut]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
