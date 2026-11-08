import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Avatar, DropdownSection, Button, User } from '@nextui-org/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

const LINKS = {
    admin: [
        { href: '/admin', label: 'Dashboard' },
        { href: '/admin/users', label: 'Users Manager' },
        { href: '/admin/rooms', label: 'Rooms Manager' },
        { href: '/admin/bookings', label: 'Bookings Manager' },
        { href: '/admin/classes', label: 'Classes & Schedules' },
        { href: '/admin/students', label: 'Dance Students' },
        { href: '/admin/attendance-records', label: 'Attendance Records' },
    ],
    instructor: [
        { href: '/profile', label: 'My Profile' },
        { href: '/profile/my-classes', label: 'My Classes' },
        { href: '/profile/my-bookings', label: 'My Bookings' },
        { href: '/profile/attendance', label: 'Attendance' },
        { href: '/profile/my-profile', label: 'Settings' },
    ],
    guest: [
        { href: '/profile', label: 'My Profile' },
        { href: '/profile/my-classes', label: 'My Classes' },
        { href: '/profile/my-bookings', label: 'My Bookings' },
        { href: '/profile/my-attendance', label: 'My Attendance' },
        { href: '/profile/my-profile', label: 'Settings' },
    ],
};
// Staff share the admin dashboard without user management.
LINKS.staff = LINKS.admin.filter((link) => link.href !== '/admin/users');

const AvatarUser = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
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
        <div className="flex items-center gap-4">
            <Dropdown
                radius="sm"
                classNames={{
                    base: 'before:bg-default-200',
                    content: 'p-0 border-small border-divider bg-background',
                }}
            >
                <DropdownTrigger>
                    <Avatar {...AVATAR_DEFAULTS}
                        isBordered
                        radius="sm"
                        as="button"
                        className="transition-transform"
                        src={user.avatar_url ?? undefined}
                        name={displayName}
                        aria-label="Account menu"
                    />
                </DropdownTrigger>
                <DropdownMenu
                    aria-label="Account menu"
                    disabledKeys={['profile']}
                    className="p-3 text-center"
                    itemClasses={{
                        base: [
                            'rounded-md',
                            'text-default-500',
                            'transition-opacity',
                            'data-[hover=true]:text-foreground',
                            'data-[hover=true]:bg-default-100',
                            'data-[selectable=true]:focus:bg-default-50',
                            'data-[pressed=true]:opacity-70',
                            'data-[focus-visible=true]:ring-default-500',
                        ],
                    }}
                >
                    <DropdownSection aria-label="Account" showDivider>
                        <DropdownItem isReadOnly key="profile" className="h-14 gap-2 opacity-100" textValue={displayName}>
                            <User
                                name={displayName}
                                description={user.email}
                                classNames={{ name: 'text-default-600', description: 'text-default-500' }}
                                avatarProps={{ ...AVATAR_DEFAULTS, size: 'md', src: user.avatar_url ?? undefined, name: displayName }}
                            />
                        </DropdownItem>
                    </DropdownSection>

                    <DropdownSection aria-label="Pages" showDivider>
                        {links.map((link) => (
                            <DropdownItem key={link.href} href={link.href}>
                                {link.label}
                            </DropdownItem>
                        ))}
                    </DropdownSection>

                    <DropdownSection aria-label="Log out">
                        <DropdownItem isReadOnly key="logout" className="text-center" textValue="Log out">
                            <Button onPress={handleLogout} radius="full" className="bg-gradient-to-tr from-red-500 to-red-800 text-white shadow-lg">
                                Log Out
                            </Button>
                        </DropdownItem>
                    </DropdownSection>
                </DropdownMenu>
            </Dropdown>
        </div>
    );
};

export default AvatarUser;
