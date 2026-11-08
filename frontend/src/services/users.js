import { supabase } from '@/lib/supabase';
import { AppError, MESSAGES, toAppError, unwrap } from './errors';

export const PROFILE_COLUMNS =
    'id, email, username, full_name, role, date_of_birth, contact_number, avatar_path, created_at, updated_at';

// Columns a profile owner (or staff) may edit. Role and email are guarded server-side.
const EDITABLE = ['username', 'full_name', 'contact_number', 'date_of_birth', 'avatar_path'];

function toPatch(fields) {
    const patch = {};
    for (const key of EDITABLE) {
        if (!(key in fields)) continue;
        const value = typeof fields[key] === 'string' ? fields[key].trim() : fields[key];
        // full_name is NOT NULL with default ''; the rest are nullable.
        patch[key] = key === 'full_name' ? value ?? '' : value || null;
    }
    return patch;
}

export async function getProfile(id) {
    return unwrap(await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).single());
}

export async function updateProfile(id, fields) {
    return unwrap(
        await supabase.from('profiles').update(toPatch(fields)).eq('id', id).select(PROFILE_COLUMNS).single()
    );
}

export async function listProfiles() {
    return unwrap(await supabase.from('profiles').select(PROFILE_COLUMNS).order('created_at', { ascending: false }));
}

async function listByRole(role) {
    return unwrap(await supabase.from('profiles').select(PROFILE_COLUMNS).eq('role', role).order('full_name'));
}

export const listInstructors = () => listByRole('instructor');
export const listGuests = () => listByRole('guest');

// Admin only (checked in the RPC).
export async function setRole(userId, role) {
    return unwrap(await supabase.rpc('admin_set_role', { p_user: userId, p_role: role }));
}

// Anyone may call it (sign-up form). False for blank input.
export async function isUsernameAvailable(username) {
    return unwrap(await supabase.rpc('is_username_available', { p_username: username }));
}

// Failures come back as { error: "CODE: message", code } (api-contract §6). The message is written
// for people (e.g. which records still block a delete), so admins see it.
async function invokeAdminUsers(body) {
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (!error) return data;

    let payload = null;
    try {
        payload = await error.context?.json();
    } catch {
        // The response body was not JSON.
    }
    if (payload?.code && MESSAGES[payload.code]) {
        const detail = String(payload.error ?? '').replace(/^[A-Z_]+:\s*/, '').replace(/\.$/, '');
        throw new AppError(payload.code, detail ? `${detail.charAt(0).toUpperCase()}${detail.slice(1)}.` : MESSAGES[payload.code]);
    }
    throw toAppError(payload?.error || error.message);
}

// Admin only: auth users can only be created, re-emailed or deleted with the service role (api-contract §6).
export function createUser({ email, password, fullName, role, contactNumber, dateOfBirth }) {
    return invokeAdminUsers({
        action: 'create',
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
        contact_number: contactNumber?.trim() || undefined,
        date_of_birth: dateOfBirth || undefined,
    });
}

export function updateUserEmail(userId, email) {
    return invokeAdminUsers({ action: 'update', user_id: userId, email: email.trim() });
}

export function deleteUser(userId) {
    return invokeAdminUsers({ action: 'delete', user_id: userId });
}
