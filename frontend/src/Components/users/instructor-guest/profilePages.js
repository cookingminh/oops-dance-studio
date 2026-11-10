import { LuCalendarDays, LuClipboardCheck, LuLayoutDashboard, LuTicket, LuUserCog, LuReceipt } from 'react-icons/lu';
import { ROLES } from '@/auth/roles';

// /profile pages per role: the sidebar groups them and the top bar shows the current one.
const ACCOUNT = {
    group: 'Account',
    items: [{ to: '/profile/my-profile', label: 'Profile settings', icon: LuUserCog, description: 'Your photo, details, language and password.' }],
};

export const PROFILE_NAV = {
    [ROLES.instructor]: [
        {
            group: 'Overview',
            items: [{ to: '/profile', end: true, label: 'Overview', icon: LuLayoutDashboard, description: 'Your teaching week at a glance.' }],
        },
        {
            group: 'Teaching',
            items: [
                { to: '/profile/attendance', label: 'Check in', icon: LuClipboardCheck, description: 'Check in and out of today’s sessions with a photo.' },
                { to: '/profile/my-classes', label: 'My Classes', icon: LuCalendarDays, description: 'Current routines, schedules and students of every class you teach.' },
                { to: '/profile/my-bookings', label: 'My Bookings', icon: LuTicket, description: 'Rooms you have booked.' },
            ],
        },
        ACCOUNT,
    ],
    // A student's attendance lives in each class's view (My Classes); the full history page is
    // linked from there and from the overview, so it is not a menu item of its own.
    [ROLES.guest]: [
        {
            group: 'Overview',
            items: [{ to: '/profile', end: true, label: 'Overview', icon: LuLayoutDashboard, description: 'Your classes and bookings at a glance.' }],
        },
        {
            group: 'Dancing',
            items: [
                { to: '/profile/my-classes', label: 'My Classes', icon: LuCalendarDays, description: 'Each class’s song, schedule and your attendance.' },
                { to: '/profile/tuition', label: 'Tuition', icon: LuReceipt, description: 'Pay for your courses and renew your classes.' },
                { to: '/profile/my-bookings', label: 'My Bookings', icon: LuTicket, description: 'Rooms you have booked.' },
            ],
        },
        ACCOUNT,
    ],
};

// Pages opened from inside another page: the top bar shows them, the menu highlights `parent`.
const SUB_PAGES = {
    [ROLES.guest]: [{ to: '/profile/my-attendance', parent: '/profile/my-classes', label: 'My Attendance', description: 'Sessions you attended or missed.' }],
};

// The role's page whose path matches best (longest prefix), falling back to the overview.
export function findProfilePage(role, pathname) {
    const nav = PROFILE_NAV[role] ?? PROFILE_NAV[ROLES.guest];
    const pages = [...nav.flatMap((section) => section.items), ...(SUB_PAGES[role] ?? [])];
    const path = pathname.replace(/\/+$/, '') || '/profile';
    const page =
        pages
            .filter((item) => path === item.to || (!item.end && path.startsWith(`${item.to}/`)))
            .sort((a, b) => b.to.length - a.to.length)[0] ?? pages[0];
    return page.parent ? { ...page, to: page.parent } : page;
}
