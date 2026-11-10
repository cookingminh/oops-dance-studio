import { supabase } from '@/lib/supabase';
import { AppError, toAppError } from './errors';

export async function getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw toAppError(error);
    return data.session;
}

// Returns an unsubscribe function.
export function onAuthChange(callback) {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return () => data.subscription.unsubscribe();
}

export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toAppError(error);
    return data.session;
}

// The role is never sent: the profile trigger always creates a guest (api-contract §2, §9).
export async function signUp({ email, password, username, fullName, contactNumber, dateOfBirth }) {
    const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
            data: {
                username: username.trim() || null,
                full_name: fullName.trim(),
                contact_number: contactNumber?.trim() || null,
                date_of_birth: dateOfBirth || null,
            },
            emailRedirectTo: `${window.location.origin}/home`,
        },
    });
    if (error) throw toAppError(error);
    // session is null when email confirmation is on (production).
    return { session: data.session, user: data.user };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw toAppError(error);
}

export async function changePassword(email, currentPassword, newPassword) {
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (verifyError) {
        const appError = toAppError(verifyError);
        if (appError.code === 'BAD_CREDENTIALS') throw new AppError('INVALID_INPUT', 'Your current password is incorrect.');
        throw appError;
    }
    await updatePassword(newPassword);
}

export async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw toAppError(error);
}

export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw toAppError(error);
}

// ---------------------------------------------------------------------------
// Auth redirects (OAuth sign-in, email links)
// ---------------------------------------------------------------------------

// What the page was opened with, read once at start-up: supabase-js and the router rewrite the URL
// later. A redirect brings back either a session (#access_token=…) or an error, in the query
// string or the hash (?error=…&error_code=…&error_description=…).
const landing = readLanding();

function readLanding() {
    if (typeof window === 'undefined') return { path: null, error: null, withSession: false };
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const pick = (key) => query.get(key) || hash.get(key) || '';
    const error = { error: pick('error'), code: pick('error_code'), description: pick('error_description') };
    return {
        path: window.location.pathname,
        error: error.error || error.code || error.description ? error : null,
        withSession: hash.has('access_token'),
    };
}

// The error a redirect brought back to `pathname` (an OAuth sign-in on /login, a reset link on
// /reset-password), or null. The page shows it once, then calls clearAuthRedirect().
export const authRedirectErrorFor = (pathname) => (landing.path === pathname ? landing.error : null);

export function clearAuthRedirect() {
    landing.error = null;
    landing.withSession = false;
    rememberProvider(null);
}

// True when `pathname` was opened by a successful OAuth redirect: supabase-js is still turning
// the tokens in the URL into a session.
export const openedWithSession = (pathname) => landing.path === pathname && landing.withSession;

// ---------------------------------------------------------------------------
// Sign-in with Google / Facebook (Supabase OAuth)
// ---------------------------------------------------------------------------

const PROVIDER_NAMES = { google: 'Google', facebook: 'Facebook' };

// Buttons shown on /login and /register: VITE_AUTH_PROVIDERS=google,facebook (in that order).
// Each provider must also be switched on in Supabase Auth (supabase/README.md). Unset = none.
export const OAUTH_PROVIDERS = [
    ...new Set((import.meta.env.VITE_AUTH_PROVIDERS ?? '').split(',').map((name) => name.trim().toLowerCase())),
].filter((name) => name in PROVIDER_NAMES);

export const providerName = (provider) => PROVIDER_NAMES[provider] ?? provider;

// Remembered for the trip to the provider, so an error coming back can name it.
const PROVIDER_KEY = 'oops-oauth-provider';

function rememberProvider(provider) {
    try {
        if (provider) sessionStorage.setItem(PROVIDER_KEY, provider);
        else sessionStorage.removeItem(PROVIDER_KEY);
    } catch {
        // Storage blocked: the message just won't name the provider.
    }
}

function rememberedProvider() {
    try {
        return sessionStorage.getItem(PROVIDER_KEY);
    } catch {
        return null;
    }
}

// Auth server and provider errors, in words people understand ({provider} is filled in).
const OAUTH_MESSAGES = [
    [/provider is not enabled|unsupported provider|provider_disabled/i, 'Sign-in with {provider} isn’t switched on yet. Please use your email for now.'],
    [/access_denied|user_denied|cancel/i, 'Sign-in with {provider} was cancelled. You can try again, or use your email.'],
    [/needs_verification|unverified email/i, 'Please confirm your {provider} email address first, then try again.'],
    [/email/i, '{provider} didn’t share your email address with us. Allow it and try again, or sign up with email.'],
    [/signup.*(disabled|not allowed)|signups not allowed/i, 'New sign-ups are paused right now. Please contact the studio.'],
    [/bad_oauth_state|bad_oauth_callback|flow_state|expired/i, 'That sign-in took too long. Please try again.'],
];
const OAUTH_FALLBACK = 'We couldn’t sign you in with {provider}. Please try again, or use your email.';

// An AppError for an OAuth failure; `vars` fills the message's placeholders.
export function oauthError({ error = '', code = '', description = '' } = {}, provider = rememberedProvider()) {
    const known = provider ?? (OAUTH_PROVIDERS.length === 1 ? OAUTH_PROVIDERS[0] : null);
    const text = `${error} ${code} ${description}`;
    const message = OAUTH_MESSAGES.find(([pattern]) => pattern.test(text))?.[1] ?? OAUTH_FALLBACK;
    const appError = new AppError('OAUTH', message, null, description);
    appError.vars = { provider: known ? providerName(known) : 'Google / Facebook' };
    return appError;
}

const withoutSkipRedirect = (url) => {
    const next = new URL(url);
    next.searchParams.delete('skip_http_redirect');
    return next.toString();
};

// Leaves for the provider's sign-in page. It comes back to /login, where supabase-js reads the
// session from the URL and <PublicOnly> sends the user home, just like a password login.
// Auth answers a provider that is switched off with a bare JSON error page instead of redirecting
// back, so ask it first: with skipBrowserRedirect it replies with JSON (the provider's URL or the
// error) and the error can be shown on the form.
export async function signInWithProvider(provider) {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login`, skipBrowserRedirect: true },
    });
    if (error) throw toAppError(error);
    if (navigator.onLine === false) throw new AppError('NETWORK');

    let target = withoutSkipRedirect(data.url);
    try {
        const response = await fetch(data.url);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw oauthError({ code: body.error_code, description: body.msg ?? body.message ?? body.error_description }, provider);
        if (body.url) target = body.url;
    } catch (failure) {
        if (failure instanceof AppError) throw failure;
        // Couldn't ask (blocked request): go the normal way and let the redirect run.
    }
    rememberProvider(provider);
    window.location.assign(target);
}
