import { useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useAuth } from '@/auth/useAuth';
import { useRoleLabel } from '@/hooks/useRoleLabel';
import { DASHBOARD_ROLES, ROLES } from '@/auth/roles';
import { isLockedDemoAccount } from '@/lib/demo';
import { useAvatarUpload, usePasswordChange, useProfileForm } from '@/hooks/useAccountSettings';
import { useI18n } from '@/i18n/i18nContext';
import ProfileHero from './ProfileHero';
import SectionNav from './SectionNav';
import DetailsCard from './DetailsCard';
import PreferencesCard from './PreferencesCard';
import PasswordCard from './PasswordCard';
import { SECTIONS, SECTION_IDS, changedFields, profileErrors } from './settingsModel';
import { useFlash, useScrollSpy, useUnsavedWarning, useUsernameCheck } from './settingsHooks';
import './settings.scss';

// Who sees the details, in the reader's terms (English; translated where shown).
function personalSubtitle(role, roleLabel) {
    if (DASHBOARD_ROLES.includes(role)) return 'How you appear to the rest of the studio team.';
    if (role === ROLES.instructor) return 'Your students see your name and photo on their classes.';
    if (roleLabel === 'Student') return 'Your instructors see your name and photo in class.';
    return 'Your details at the studio.';
}

function emailNote(role, lockedDemo) {
    if (lockedDemo) return 'Demo accounts can’t change their email or password.';
    if (role === ROLES.admin) return 'Change it from Users.';
    if (role === ROLES.staff) return 'Ask an admin to change your email.';
    return 'Contact the studio to change your email.';
}

// The personal page for whoever is signed in (/admin/settings and /profile/my-profile): who you are
// at the top, then your details (one save bar), preferences and password, with an "on this page"
// nav on wide screens.
const ProfileSettings = () => {
    const { user, role } = useAuth();
    const { t } = useI18n();
    const roleLabel = useRoleLabel();
    const reduceMotion = useReducedMotion();
    const form = useProfileForm();
    const avatar = useAvatarUpload();
    const password = usePasswordChange();
    const photoInputRef = useRef(null);
    const [active, setActive] = useScrollSpy(SECTION_IDS);
    const [justSaved, flashSaved] = useFlash();
    const lockedDemo = isLockedDemoAccount(user.email);

    const { profile, saved } = form;
    const errors = profileErrors(profile, saved);
    const usernameStatus = useUsernameCheck(profile.username, saved.username);
    const canSave =
        form.isDirty && !form.saving && Object.keys(errors).length === 0 && usernameStatus !== 'checking' && usernameStatus !== 'taken';
    useUnsavedWarning(form.isDirty);

    // Sections holding unsaved fields get a dot in the nav.
    const changed = changedFields(profile, saved);
    const unsaved = new Set(SECTIONS.filter((section) => section.fields.some((field) => changed.includes(field))).map((section) => section.id));

    // The hero follows the form as you type.
    const displayName = profile.full_name.trim() || profile.username.trim() || user.full_name || user.username || user.email;
    const username = profile.username.trim() || user.username;

    const scrollTo = (element, block) => element?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block });

    const jumpTo = (id) => {
        const section = document.getElementById(id);
        scrollTo(section, 'start');
        section?.focus({ preventScroll: true });
        setActive(id);
    };

    // From the profile checklist: open the photo picker or bring the field into view and focus it.
    const fixField = (field) => {
        if (field === 'photo') {
            photoInputRef.current?.click();
            return;
        }
        const wrapper = document.querySelector(`[data-field="${field}"]`);
        if (!wrapper) return;
        scrollTo(wrapper, 'center');
        (wrapper.querySelector('[role="spinbutton"]') ?? wrapper.querySelector('input'))?.focus({ preventScroll: true });
    };

    const save = async () => {
        if (await form.save()) flashSaved();
    };

    return (
        <div className="settingsPage">
            <ProfileHero
                user={user}
                roleLabel={roleLabel}
                displayName={displayName}
                username={username}
                avatar={avatar}
                photoInputRef={photoInputRef}
                onFix={fixField}
            />

            <div className="settingsLayout">
                <SectionNav active={active} unsaved={unsaved} onJump={jumpTo} />
                <div className="settingsSections">
                    <DetailsCard
                        form={form}
                        errors={errors}
                        usernameStatus={usernameStatus}
                        canSave={canSave}
                        justSaved={justSaved}
                        onSave={save}
                        email={user.email}
                        emailNote={t(emailNote(role, lockedDemo))}
                        personalSubtitle={t(personalSubtitle(role, roleLabel))}
                    />
                    <PreferencesCard />
                    <PasswordCard password={password} locked={lockedDemo} />
                </div>
            </div>
        </div>
    );
};

export default ProfileSettings;
