import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar, DropdownSection, User } from '@nextui-org/react';
import { useNavigate } from 'react-router-dom';
import {
    LuCalendarCheck,
    LuClipboardList,
    LuDoorOpen,
    LuLayoutDashboard,
    LuLogOut,
    LuMusic,
    LuSettings,
    LuUserCheck,
    LuUsers,
} from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

const LINKS = {
    admin: [
        { href: '/admin', label: 'Dashboard', icon: LuLayoutDashboard },
        { href: '/admin/users', label: 'Users Manager', icon: LuUsers },
        { href: '/admin/rooms', label: 'Rooms Manager', icon: LuDoorOpen },
        { href: '/admin/bookings', label: 'Bookings Manager', icon: LuCalendarCheck },
        { href: '/admin/classes', label: 'Classes', icon: LuMusic },
        { href: '/admin/attendance', label: 'Attendance', icon: LuClipboardList },
    ],
    instructor: [
        { href: '/profile', label: 'My Profile', icon: LuLayoutDashboard },
        { href: '/profile/my-classes', label: 'My Classes', icon: LuMusic },
        { href: '/profile/my-bookings', label: 'My Bookings', icon: LuCalendarCheck },
        { href: '/profile/attendance', label: 'Attendance', icon: LuUserCheck },
        { href: '/profile/my-profile', label: 'Settings', icon: LuSettings },
    ],
    guest: [
        { href: '/profile', label: 'My Profile', icon: LuLayoutDashboard },
        { href: '/profile/my-classes', label: 'My Classes', icon: LuMusic },
        { href: '/profile/my-bookings', label: 'My Bookings', icon: LuCalendarCheck },
        { href: '/profile/my-attendance', label: 'My Attendance', icon: LuUserCheck },
        { href: '/profile/my-profile', label: 'Settings', icon: LuSettings },
    ],
};
// Staff share the admin dashboard without user management.
LINKS.staff = LINKS.admin.filter((link) => link.href !== '/admin/users');

// Signed-in visitor's menu in the public navbar: who you are, your pages, log out.
const AvatarUser = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const { t } = useI18n();
    if (!user) return null;

    const handleLogout = async () => {
        try {
            await signOut();
            navigate('/home');
        } catch (error) {
            toast.error(error);
        }
    };

    const links = LINKS[user.role] ?? [];
    const displayName = user.full_name || user.username || user.email;

    return (
        <Dropdown
            placement="bottom-end"
            radius="lg"
            classNames={{ content: 'p-0 border-small border-divider bg-background min-w-[15rem]' }}
        >
            <DropdownTrigger>
                <Avatar
                    {...AVATAR_DEFAULTS}
                    isBordered
                    color="danger"
                    as="button"
                    className="shrink-0 transition-transform data-[hover=true]:scale-105"
                    src={user.avatar_url ?? undefined}
                    name={displayName}
                    aria-label={t('Account menu')}
                />
            </DropdownTrigger>
            <DropdownMenu
                aria-label={t('Account menu')}
                disabledKeys={['profile']}
                className="p-2"
                itemClasses={{
                    base: ['rounded-xl', 'gap-3', 'px-3', 'py-2', 'text-default-600', 'data-[hover=true]:bg-danger-50', 'data-[hover=true]:text-danger-600'],
                }}
            >
                <DropdownSection aria-label={t('Account')} showDivider>
                    <DropdownItem isReadOnly key="profile" className="h-14 opacity-100 cursor-default" textValue={displayName}>
                        <User
                            name={displayName}
                            description={user.email}
                            classNames={{ name: 'text-default-700 font-semibold', description: 'text-default-500' }}
                            avatarProps={{ ...AVATAR_DEFAULTS, size: 'sm', src: user.avatar_url ?? undefined, name: displayName }}
                        />
                    </DropdownItem>
                </DropdownSection>

                <DropdownSection aria-label={t('Pages')} showDivider>
                    {links.map(({ href, label, icon: Icon }) => (
                        <DropdownItem key={href} href={href} startContent={<Icon className="text-lg shrink-0" aria-hidden="true" />}>
                            {t(label)}
                        </DropdownItem>
                    ))}
                </DropdownSection>

                <DropdownSection aria-label={t('Log out')}>
                    <DropdownItem
                        key="logout"
                        color="danger"
                        className="text-danger"
                        startContent={<LuLogOut className="text-lg shrink-0" aria-hidden="true" />}
                        onPress={handleLogout}
                    >
                        {t('Log Out')}
                    </DropdownItem>
                </DropdownSection>
            </DropdownMenu>
        </Dropdown>
    );
};

export default AvatarUser;
