import {
    LuCalendarDays,
    LuClipboardCheck,
    LuDoorOpen,
    LuGraduationCap,
    LuLayoutDashboard,
    LuPieChart,
    LuTicket,
    LuUserCog,
    LuUsers,
} from 'react-icons/lu';

// Every /admin page: the sidebar groups them and the top bar shows the current one's title.
export const ADMIN_NAV = [
    {
        group: 'Overview',
        items: [
            { to: '/admin', end: true, label: 'Dashboard', icon: LuLayoutDashboard, description: 'Today at the studio at a glance.' },
            { to: '/admin/charts', label: 'Charts', icon: LuPieChart, description: 'Revenue, bookings and enrolment over time.' },
        ],
    },
    {
        group: 'Studio',
        items: [
            { to: '/admin/bookings', label: 'Bookings', icon: LuTicket, description: 'Approve requests and keep track of payments.' },
            { to: '/admin/rooms', label: 'Rooms', icon: LuDoorOpen, description: 'Room details, sizes and hourly prices.' },
            { to: '/admin/classes', label: 'Classes', icon: LuCalendarDays, description: 'Monthly lessons, instructors and the weekly timetable.' },
        ],
    },
    {
        group: 'People',
        items: [
            { to: '/admin/students', label: 'Students', icon: LuGraduationCap, description: 'Today’s student attendance and class members.' },
            { to: '/admin/attendance-records', label: 'Instructor Attendance', icon: LuClipboardCheck, description: 'Check-ins, proof photos and session approvals.' },
            { to: '/admin/users', label: 'Users', icon: LuUsers, adminOnly: true, description: 'Accounts and roles for everyone at the studio.' },
        ],
    },
    {
        group: 'Account',
        items: [
            { to: '/admin/settings', label: 'Profile settings', icon: LuUserCog, description: 'Your photo, contact details and password.' },
        ],
    },
];

const ALL_PAGES = ADMIN_NAV.flatMap((section) => section.items);

// The page whose path matches best (longest prefix), falling back to the dashboard.
export function findAdminPage(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/admin';
    return (
        ALL_PAGES.filter((page) => path === page.to || (!page.end && path.startsWith(`${page.to}/`)))
            .sort((a, b) => b.to.length - a.to.length)[0] ?? ALL_PAGES[0]
    );
}
