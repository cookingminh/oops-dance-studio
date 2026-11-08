import { useState } from 'react';
import { useAuth } from '@/auth/useAuth';
import { changePassword } from '@/services/auth';
import { updateProfile } from '@/services/users';
import { BUCKETS, removeFiles, uploadAvatar } from '@/services/storage';
import { useToast } from '@/ui/feedback/toastContext';

// Settings for the signed-in user, shared by /profile/my-profile and /admin/settings.

export const MIN_PASSWORD_LENGTH = 8; // auth.minimum_password_length in supabase/config.toml
const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' };

const editableFieldsOf = (user) => ({
    username: user.username ?? '',
    full_name: user.full_name ?? '',
    contact_number: user.contact_number ?? '',
    date_of_birth: user.date_of_birth ?? '',
});

// Name, username, phone and birthday. `isDirty` ignores surrounding spaces (they are trimmed on save).
export function useProfileForm() {
    const { user, refreshProfile } = useAuth();
    const toast = useToast();
    const [profile, setProfile] = useState(() => editableFieldsOf(user));
    const [saving, setSaving] = useState(false);

    const setField = (field) => (value) => setProfile((prev) => ({ ...prev, [field]: value }));
    const saved = editableFieldsOf(user);
    const isDirty = Object.keys(saved).some((key) => String(profile[key]).trim() !== String(saved[key]).trim());

    const save = async () => {
        setSaving(true);
        try {
            await updateProfile(user.id, profile);
            await refreshProfile();
            toast.success('Profile updated.');
        } catch (error) {
            toast.error(error.code === 'DUPLICATE' ? 'That username is already taken.' : error);
        } finally {
            setSaving(false);
        }
    };

    return { profile, setField, isDirty, reset: () => setProfile(saved), save, saving };
}

// A picked (already prepared) image and the upload that replaces the current avatar.
// Bump `pickerKey` on the ImagePicker so it forgets the file after saving or cancelling.
export function useAvatarUpload() {
    const { user, refreshProfile } = useAuth();
    const toast = useToast();
    const [file, setFile] = useState(null);
    const [pickerKey, setPickerKey] = useState(0);
    const [saving, setSaving] = useState(false);

    const clear = () => {
        setFile(null);
        setPickerKey((key) => key + 1);
    };

    const save = async () => {
        setSaving(true);
        try {
            const path = await uploadAvatar(user.id, file);
            await updateProfile(user.id, { avatar_path: path });
            // A different extension means a different object; drop the old one.
            if (user.avatar_path && user.avatar_path !== path) await removeFiles(BUCKETS.avatars, [user.avatar_path]);
            await refreshProfile();
            clear();
            toast.success('Profile picture updated.');
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return { file, setFile, pickerKey, clear, save, saving };
}

// Current password + new password twice. Not offered to locked demo accounts.
export function usePasswordChange() {
    const { user } = useAuth();
    const toast = useToast();
    const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
    const [saving, setSaving] = useState(false);

    const setPassword = (field) => (value) => setPasswords((prev) => ({ ...prev, [field]: value }));
    const tooShort = passwords.next.length > 0 && passwords.next.length < MIN_PASSWORD_LENGTH;
    const mismatch = passwords.confirm.length > 0 && passwords.confirm !== passwords.next;

    const submit = async (event) => {
        event.preventDefault();
        if (tooShort || mismatch) return;
        setSaving(true);
        try {
            await changePassword(user.email, passwords.current, passwords.next);
            setPasswords(EMPTY_PASSWORDS);
            toast.success('Password changed.');
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    return { passwords, setPassword, tooShort, mismatch, submit, saving };
}
