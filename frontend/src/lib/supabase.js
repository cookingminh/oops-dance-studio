import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    throw new Error(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.'
    );
}

// Read before createClient: the client strips the recovery tokens from the URL while it starts.
const urlHash = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.slice(1));
export const openedFromRecoveryLink = urlHash.get('type') === 'recovery';
// Set when an email link (e.g. password reset) was invalid or expired.
export const authRedirectError = urlHash.get('error_description');

export const supabase = createClient(url, anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
