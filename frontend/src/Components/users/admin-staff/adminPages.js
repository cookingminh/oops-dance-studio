import {
    LuBanknote,
    LuCalendarDays,
    LuClipboardCheck,
    LuDoorOpen,
    LuHistory,
    LuLayoutDashboard,
    LuLineChart,
    LuPieChart,
    LuReceipt,
    LuTicket,
    LuUserCog,
    LuUsers,
    LuWallet,
} from 'react-icons/lu';

// Every /admin page: the sidebar groups them and the top bar shows the current one's title.
export const ADMIN_NAV = [
    {
        group: 'Overview',
        items: [
            { to: '/admin', end: true, label: 'Dashboard', icon: LuLayoutDashboard, description: 'Today at the studio at a glance.' },
            { to: '/admin/charts', label: 'Charts', icon: LuPieChart, description: 'Revenue, bookings and enrolment over time.' },
            { to: '/admin/activity', label: 'Activity', icon: LuHistory, adminOnly: true, description: 'Who did what at the studio, and when.' },
        ],
    },
    {
        group: 'Studio',
        items: [
            { to: '/admin/bookings', label: 'Bookings', icon: LuTicket, description: 'Approve requests and keep track of payments.' },
            { to: '/admin/rooms', label: 'Rooms', icon: LuDoorOpen, description: 'Room details, sizes and hourly prices.' },
            { to: '/admin/classes', label: 'Classes', icon: LuCalendarDays, description: 'Every class in one place: students, sessions, tuition, routines and money.' },
        ],
    },
    {
        group: 'People',
        items: [
            { to: '/admin/attendance', label: 'Attendance', icon: LuClipboardCheck, description: 'Today’s roll calls and check-ins, and every session on a calendar.' },
            { to: '/admin/users', label: 'Users', icon: LuUsers, adminOnly: true, description: 'Accounts and roles for everyone at the studio.' },
        ],
    },
    {
        group: 'Finance',
        items: [
            { to: '/admin/tuition', label: 'Tuition', icon: LuReceipt, description: 'Who has paid for each course, renewals and bank transfers.' },
            { to: '/admin/expenses', label: 'Expenses', icon: LuBanknote, description: 'Rent, the monthly shoot, costumes and every other cost.' },
            { to: '/admin/payroll', label: 'Payroll', icon: LuWallet, adminOnly: true, description: 'Pay instructors per session and staff their monthly salary.' },
            { to: '/admin/reports', label: 'Reports', icon: LuLineChart, adminOnly: true, description: 'Monthly revenue, costs, profit and student retention.' },
        ],
    },
    {
        group: 'Account',
        items: [
            { to: '/admin/settings', label: 'Profile settings', icon: LuUserCog, description: 'Your photo, details, language and password.' },
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
