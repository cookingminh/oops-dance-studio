import { useEffect, useState } from 'react';
import { signInWithProvider } from '@/services/auth';

// Starts "Continue with Google / Facebook". `pending` is the provider on its way (its button
// spins and the others wait); `onError` gets an AppError when the trip can't start.
export function useProviderSignIn(onError) {
    const [pending, setPending] = useState(null);

    useEffect(() => {
        // Back from the provider with the browser's Back button: the page comes back from the
        // cache as it was left, spinner and all.
        const reset = (event) => event.persisted && setPending(null);
        window.addEventListener('pageshow', reset);
        return () => window.removeEventListener('pageshow', reset);
    }, []);

    const start = async (provider) => {
        setPending(provider);
        try {
            await signInWithProvider(provider);
        } catch (error) {
            setPending(null);
            onError(error);
        }
    };

    return { pending, start };
}
