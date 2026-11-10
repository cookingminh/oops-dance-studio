import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { forgetMyTuition } from '@/services/tuitionStudent';
import { loadMyDues } from './myDues';
import { MyDuesContext } from './myDuesContext';

const REFRESH_MS = 60_000;

// Keeps what the signed-in person owes up to date for the bell, the menu badges and the reminder:
// on every page change (the tuition and bookings pages change it), every minute and on demand.
const MyDuesProvider = ({ children }) => {
    const { user, role } = useAuth();
    const { pathname } = useLocation();
    const [state, setState] = useState({ data: undefined, loading: true });
    const seq = useRef(0);

    const refresh = useCallback(
        async (fresh = false) => {
            if (!user) return;
            if (fresh) forgetMyTuition();
            const mine = ++seq.current;
            setState((current) => ({ ...current, loading: true }));
            try {
                const data = await loadMyDues(user, role);
                if (mine === seq.current) setState({ data, loading: false });
            } catch {
                // A reminder is a nicety: keep what we had.
                if (mine === seq.current) setState((current) => ({ ...current, loading: false }));
            }
        },
        [user, role]
    );

    useEffect(() => {
        refresh();
    }, [refresh, pathname]);

    useEffect(() => {
        const timer = setInterval(() => refresh(), REFRESH_MS);
        return () => clearInterval(timer);
    }, [refresh]);

    const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
    return <MyDuesContext.Provider value={value}>{children}</MyDuesContext.Provider>;
};

export default MyDuesProvider;
