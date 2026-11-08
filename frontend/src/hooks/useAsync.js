import { useCallback, useEffect, useRef, useState } from 'react';
import { toAppError } from '@/services/errors';

// Runs `fn` when `deps` change and tracks { data, error, loading }. `reload()` re-runs it;
// responses from superseded calls are dropped.
export function useAsync(fn, deps = []) {
    const [state, setState] = useState({ data: undefined, error: null, loading: true });
    const latestCall = useRef(0);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const run = useCallback(fn, deps);

    const reload = useCallback(async () => {
        const callId = ++latestCall.current;
        setState((prev) => ({ ...prev, loading: true, error: null }));
        try {
            const data = await run();
            if (callId === latestCall.current) setState({ data, error: null, loading: false });
            return data;
        } catch (error) {
            if (callId === latestCall.current) {
                setState((prev) => ({ data: prev.data, error: toAppError(error), loading: false }));
            }
            return undefined;
        }
    }, [run]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { ...state, reload };
}
