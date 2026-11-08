import { useState } from 'react';
import { Card, CardFooter, Image, Button, Input, Avatar } from '@nextui-org/react';
import { useAuth } from '@/auth/useAuth';
import { changePassword } from '@/services/auth';
import { isLockedDemoAccount } from '@/lib/demo';
import { updateProfile } from '@/services/users';
import { BUCKETS, removeFiles, uploadAvatar } from '@/services/storage';
import { useToast } from '@/ui/feedback/toastContext';
import DateField from '@/ui/DateField';
import ImagePicker from '@/ui/ImagePicker';
import './setting.scss';
import studio_img from '@/assets/images/studio.webp';
import video from '@/assets/video/dashboard.mp4';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

const MIN_PASSWORD_LENGTH = 8;
const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' };

const Setting = () => {
    const { user, refreshProfile } = useAuth();
    const toast = useToast();
    const name = user.full_name || user.username;
    const lockedDemo = isLockedDemoAccount(user.email);

    // ---- Profile ----------------------------------------------------------
    const [profile, setProfile] = useState({
        username: user.username ?? '',
        full_name: user.full_name ?? '',
        contact_number: user.contact_number ?? '',
        date_of_birth: user.date_of_birth ?? '',
    });
    const [savingProfile, setSavingProfile] = useState(false);
    const setField = (field) => (value) => setProfile((prev) => ({ ...prev, [field]: value }));

    const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
            await updateProfile(user.id, profile);
            await refreshProfile();
            toast.success('Profile updated.');
        } catch (error) {
            toast.error(error.code === 'DUPLICATE' ? 'That username is already taken.' : error);
        } finally {
            setSavingProfile(false);
        }
    };

    // ---- Avatar -----------------------------------------------------------
    const [avatar, setAvatar] = useState(null);
    const [pickerKey, setPickerKey] = useState(0);
    const [savingAvatar, setSavingAvatar] = useState(false);

    const handleChangeAvatar = async () => {
        setSavingAvatar(true);
        try {
            const path = await uploadAvatar(user.id, avatar);
            await updateProfile(user.id, { avatar_path: path });
            // A different extension means a different object; drop the old one.
            if (user.avatar_path && user.avatar_path !== path) await removeFiles(BUCKETS.avatars, [user.avatar_path]);
            await refreshProfile();
            setAvatar(null);
            setPickerKey((key) => key + 1);
            toast.success('Profile picture updated.');
        } catch (error) {
            toast.error(error);
        } finally {
            setSavingAvatar(false);
        }
    };

    // ---- Password ---------------------------------------------------------
    const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
    const [savingPassword, setSavingPassword] = useState(false);
    const setPassword = (field) => (value) => setPasswords((prev) => ({ ...prev, [field]: value }));
    const tooShort = passwords.next.length > 0 && passwords.next.length < MIN_PASSWORD_LENGTH;
    const mismatch = passwords.confirm.length > 0 && passwords.confirm !== passwords.next;

    const handleSubmitPassword = async (event) => {
        event.preventDefault();
        if (tooShort || mismatch) return;
        setSavingPassword(true);
        try {
            await changePassword(user.email, passwords.current, passwords.next);
            setPasswords(EMPTY_PASSWORDS);
            toast.success('Password changed.');
        } catch (error) {
            toast.error(error);
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <div className="settings-user flex flex-col gap-4">
            <div className="topSection flex gap-5 h-30 flex-col lg:flex-row">
                <div className="leftCard p-4 bg-gray-700 rounded-lg shadow-lg flex flex-col items-center justify-center">
                    <div className="header mb-4">
                        <span className="font-bold text-xl text-white">Change Profile Picture</span>
                    </div>
                    <div className="flex items-center text-center flex-col gap-10 md:flex-row">
                        <div className="bg-white w-20 h-20 flex-none rounded-3xl md:gap-10">
                            <Avatar {...AVATAR_DEFAULTS} isBordered radius="sm" className="object-hidden w-20 h-20" src={user.avatar_url ?? undefined} name={name} />
                        </div>
                        <div className="button flex gap-2 text-white">
                            <ImagePicker key={pickerKey} label="Choose Avatar" onChange={setAvatar} isDisabled={savingAvatar} />
                            {avatar && (
                                <Button color="primary" variant="bordered" onPress={handleChangeAvatar} isLoading={savingAvatar}>
                                    Save Avatar
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rightCard">
                    <div className="videoDiv">
                        <video src={video} autoPlay loop muted playsInline></video>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
                <div className="section1 col-span-2 rounded-lg flex flex-col gap-5 h-full basis-2/3">
                    <div className="generalInfo p-4 bg-white rounded-lg shadow-lg flex flex-col">
                        <div className="header mb-4">
                            <span className="font-bold text-xl">General Information</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <Input label="Full Name" value={profile.full_name} onValueChange={setField('full_name')} />
                            <Input label="Username" value={profile.username} onValueChange={setField('username')} />
                            <Input
                                label="Email"
                                value={user.email}
                                isReadOnly
                                description={lockedDemo
                                    ? 'Demo accounts can’t change their email or password.'
                                    : 'Contact the studio to change your email.'}
                            />
                            <Input label="Contact Number" type="tel" value={profile.contact_number} onValueChange={setField('contact_number')} />
                            <DateField label="Date of Birth" value={profile.date_of_birth} onChange={setField('date_of_birth')} />
                        </div>
                        <div className="button text-center mt-auto">
                            <Button color="primary" onPress={handleSaveProfile} isLoading={savingProfile}>
                                Save Changes
                            </Button>
                        </div>
                    </div>

                    {!lockedDemo && (
                        <div className="change-password p-4 bg-white rounded-lg shadow-lg">
                            <div className="header mb-4">
                                <span className="font-bold text-xl">Change Password</span>
                            </div>
                            <form onSubmit={handleSubmitPassword} className="flex flex-col gap-4 mb-6">
                                <Input
                                    label="Current password"
                                    type="password"
                                    autoComplete="current-password"
                                    isRequired
                                    value={passwords.current}
                                    onValueChange={setPassword('current')}
                                />
                                <Input
                                    label="New password"
                                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                                    type="password"
                                    autoComplete="new-password"
                                    isRequired
                                    value={passwords.next}
                                    onValueChange={setPassword('next')}
                                    isInvalid={tooShort}
                                    errorMessage={tooShort ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
                                />
                                <Input
                                    label="Confirm new password"
                                    type="password"
                                    autoComplete="new-password"
                                    isRequired
                                    value={passwords.confirm}
                                    onValueChange={setPassword('confirm')}
                                    isInvalid={mismatch}
                                    errorMessage={mismatch ? 'The passwords don’t match.' : undefined}
                                />
                                <div className="button text-center mt-auto">
                                    <Button type="submit" color="primary" isLoading={savingPassword} isDisabled={tooShort || mismatch}>
                                        Save Password
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                <div className="section2 col-span-1 flex flex-col gap-10 basis-1/3 justify-center">
                    <div className="cardDiv flex justify-center">
                        <Card isFooterBlurred radius="lg" className="border-none">
                            <Image isBlurred src={studio_img} alt="Oops! Dance Studio" />
                            <CardFooter className="justify-between before:bg-white/10 border-white/20 border-1 overflow-hidden py-1 absolute before:rounded-xl rounded-large bottom-1 w-[calc(100%_-_8px)] shadow-small ml-1 z-10">
                                <p className="text-large text-white/80 text-center">
                                    “Let Every Step Set You Free - Dance to Express, Not to Impress”
                                </p>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Setting;
