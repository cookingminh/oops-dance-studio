import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Avatar, Button, Input } from '@nextui-org/react';
import { LuAtSign, LuCake, LuCamera, LuKeyRound, LuLock, LuPhone, LuRotateCcw, LuUserCog } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { isLockedDemoAccount } from '@/lib/demo';
import { formatDate } from '@/lib/format';
import { MIN_PASSWORD_LENGTH, useAvatarUpload, usePasswordChange, useProfileForm } from '@/hooks/useAccountSettings';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import DateField from '@/ui/DateField';
import ImagePicker from '@/ui/ImagePicker';
import SectionCard from '../../common/SectionCard';
import { fadeUp } from '../../common/motion';

// Temporary URL for previewing a picked file; released when it changes or the page closes.
function useObjectUrl(file) {
    const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
    useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
    return url;
}

// /admin/settings: the signed-in admin or staff member's own photo, details and password.
const ProfileSettings = () => {
    const { user, role } = useAuth();
    const form = useProfileForm();
    const avatar = useAvatarUpload();
    const password = usePasswordChange();
    const preview = useObjectUrl(avatar.file);

    const name = user.full_name || user.username;
    const lockedDemo = isLockedDemoAccount(user.email);
    const facts = [
        { icon: LuAtSign, label: 'Username', value: user.username },
        { icon: LuPhone, label: 'Phone', value: user.contact_number },
        { icon: LuCake, label: 'Birthday', value: formatDate(user.date_of_birth) },
    ];

    return (
        <div className="settingsGrid">
            <motion.aside variants={fadeUp} className="adminCard profileCard">
                <div className="profileCover" aria-hidden="true" />
                <div className="profileIdentity">
                    <div className="profileAvatarWrap">
                        <Avatar {...AVATAR_DEFAULTS} src={preview ?? user.avatar_url ?? undefined} name={name} className="profileAvatar" />
                        {preview && <span className="previewBadge">Preview</span>}
                    </div>
                    <h2>{name}</h2>
                    <span className={`roleBadge is-${role}`}>{role}</span>
                    <span className="profileEmail">{user.email}</span>
                </div>

                <dl className="profileFacts">
                    {facts.map(({ icon: Icon, label, value }) => (
                        <div key={label}>
                            <dt>
                                <Icon aria-hidden="true" /> {label}
                            </dt>
                            <dd className={value ? undefined : 'isEmpty'}>{value || 'Not set'}</dd>
                        </div>
                    ))}
                    {user.created_at && (
                        <div>
                            <dt>Member since</dt>
                            <dd>{format(parseISO(user.created_at), 'MMMM yyyy')}</dd>
                        </div>
                    )}
                </dl>

                <div className="avatarControls">
                    <ImagePicker
                        key={avatar.pickerKey}
                        label={user.avatar_url ? 'Change photo' : 'Add a photo'}
                        color="default"
                        startContent={<LuCamera aria-hidden="true" />}
                        onChange={avatar.setFile}
                        isDisabled={avatar.saving}
                    />
                    {avatar.file && (
                        <div className="avatarActions">
                            <Button variant="light" onPress={avatar.clear} isDisabled={avatar.saving}>
                                Cancel
                            </Button>
                            <Button color="danger" onPress={avatar.save} isLoading={avatar.saving}>
                                Save photo
                            </Button>
                        </div>
                    )}
                </div>
            </motion.aside>

            <div className="settingsMain">
                <SectionCard
                    icon={LuUserCog}
                    title="General information"
                    subtitle="How you appear to the rest of the studio team."
                >
                    <div className="formGrid">
                        <Input label="Full Name" value={form.profile.full_name} onValueChange={form.setField('full_name')} />
                        <Input label="Username" value={form.profile.username} onValueChange={form.setField('username')} />
                        <Input
                            label="Email"
                            value={user.email}
                            isReadOnly
                            description={
                                lockedDemo
                                    ? 'Demo accounts can’t change their email or password.'
                                    : role === ROLES.admin
                                        ? 'Change it from Users.'
                                        : 'Ask an admin to change your email.'
                            }
                        />
                        <Input label="Contact Number" type="tel" value={form.profile.contact_number} onValueChange={form.setField('contact_number')} />
                        <DateField label="Date of Birth" value={form.profile.date_of_birth} onChange={form.setField('date_of_birth')} />
                    </div>
                    <div className="formActions">
                        {form.isDirty && (
                            <Button variant="light" startContent={<LuRotateCcw aria-hidden="true" />} onPress={form.reset} isDisabled={form.saving}>
                                Discard
                            </Button>
                        )}
                        <Button color="danger" onPress={form.save} isLoading={form.saving} isDisabled={!form.isDirty}>
                            Save Changes
                        </Button>
                    </div>
                </SectionCard>

                <SectionCard icon={LuKeyRound} title="Password" subtitle={`Use at least ${MIN_PASSWORD_LENGTH} characters you don’t use anywhere else.`}>
                    {lockedDemo ? (
                        <p className="lockedNote">
                            <LuLock aria-hidden="true" /> Demo accounts can’t change their email or password.
                        </p>
                    ) : (
                        <form onSubmit={password.submit}>
                            <div className="formGrid">
                                <Input
                                    className="isFull"
                                    label="Current password"
                                    type="password"
                                    autoComplete="current-password"
                                    isRequired
                                    value={password.passwords.current}
                                    onValueChange={password.setPassword('current')}
                                />
                                <Input
                                    label="New password"
                                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                    type="password"
                                    autoComplete="new-password"
                                    isRequired
                                    value={password.passwords.next}
                                    onValueChange={password.setPassword('next')}
                                    isInvalid={password.tooShort}
                                    errorMessage={password.tooShort ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
                                />
                                <Input
                                    label="Confirm new password"
                                    type="password"
                                    autoComplete="new-password"
                                    isRequired
                                    value={password.passwords.confirm}
                                    onValueChange={password.setPassword('confirm')}
                                    isInvalid={password.mismatch}
                                    errorMessage={password.mismatch ? 'The passwords don’t match.' : undefined}
                                />
                            </div>
                            <div className="formActions">
                                <Button type="submit" color="danger" isLoading={password.saving} isDisabled={password.tooShort || password.mismatch}>
                                    Save Password
                                </Button>
                            </div>
                        </form>
                    )}
                </SectionCard>
            </div>
        </div>
    );
};

export default ProfileSettings;
