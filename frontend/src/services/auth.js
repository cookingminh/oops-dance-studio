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
