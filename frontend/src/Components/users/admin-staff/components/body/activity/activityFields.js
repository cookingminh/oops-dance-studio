import { formatClock, formatTime, formatVnd } from '@/lib/format';
import { categoryOf } from '@/lib/expenseCategories';
import { levelOf } from '@/lib/classLevel';
import { METHOD_LABELS, RENEWAL, VOID_REASONS } from '../tuition/tuitionModel';
import { classPath } from '../class-hub/hubModel';
import { studioDateOf } from './activityModel';

// The drawer's "what changed" table (human field labels, values formatted) and the link to the
// place a record lives. Labels are English i18n keys.

export const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', instructor: 'Instructor', guest: 'Guest', student: 'Student' };

const FIELD_LABELS = {
    status: 'Status',
    date: 'Date',
    start_time: 'Start',
    end_time: 'End',
    room_id: 'Room',
    venue_id: 'Rented studio',
    guest_id: 'Guest',
    deposit: 'Deposit',
    full_payment: 'Full payment',
    real_income: 'Received',
    bank_transfer: 'Bank transfer',
    cash: 'Cash',
    deposit_status: 'Deposit status',
    details: 'Note',
    name: 'Name',
    instructor_id: 'Instructor',
    price: 'Price',
    image_path: 'Image',
    starts_on: 'Starts on',
    ended_on: 'Last day',
    end_reason: 'Reason',
    day_of_week: 'Weekday',
    title: 'Title',
    video_url: 'Video',
    session_count: 'Sessions',
    joined_at: 'Joined',
    leaves_after: 'Leaves after',
    checkin_at: 'Check-in',
    checkout_at: 'Check-out',
    checkout_late: 'Late check-out',
    is_extra: 'Make-up',
    amount: 'Amount',
    paid_amount: 'Paid',
    renewal: 'Renewal',
    method: 'Method',
    due_date: 'Due date',
    paid_at: 'Paid on',
    void_reason: 'Reason',
    note: 'Note',
    student_name: 'Student',
    student_id: 'Student',
    class_name: 'Class',
    class_id: 'Class',
    lesson_title: 'Course',
    lesson_id: 'Course',
    sessions: 'Sessions',
    switched_from: 'Switched class',
    invoice_id: 'Invoice',
    spent_on: 'Date',
    category: 'Category',
    description: 'Description',
    vendor: 'Vendor',
    receipt_path: 'Receipt',
    recurring_id: 'Recurring cost',
    day_of_month: 'Day of the month',
    ends_on: 'Ends',
    active: 'Runs every month',
    session_pay: 'Session pay',
    base_salary: 'Monthly salary',
    monthly_salary: 'Monthly salary',
    bonuses: 'Bonuses',
    deductions: 'Deductions',
    total: 'Total',
    finalized_at: 'Finalized',
    session_rate: 'Pay per session',
    default_session_rate: 'Default pay per session',
    reason: 'Reason',
    bank_code: 'Bank',
    bank_name: 'Bank',
    account_no: 'Account number',
    account_name: 'Account name',
    invoice_day: 'Invoice day',
    due_day: 'Due day',
    renewal_open_sessions: 'Renewal opens',
    due_session: 'Due by session',
    prorate_late_join: 'Pro-rate late joiners',
    size: 'Size',
    image_paths: 'Photos',
    email: 'Email',
    username: 'Username',
    full_name: 'Full name',
    role: 'Role',
    date_of_birth: 'Date of birth',
    contact_number: 'Phone',
    avatar_path: 'Photo',
    content: 'Transfer content',
    month: 'Month',
    level: 'Level',
    image_pos_x: 'Image: left – right',
    image_pos_y: 'Image: up – down',
    timetable_photo_path: 'Timetable photo',
    timetable_photo_x: 'Timetable photo: left – right',
    timetable_photo_y: 'Timetable photo: up – down',
    timetable_photo_zoom: 'Timetable photo: zoom',
};
// Shorter names for the one-line "Changed: …" fact, where one move of a picture changes a few columns at once.
const SUMMARY_LABELS = {
    image_pos_x: 'Image position',
    image_pos_y: 'Image position',
    timetable_photo_x: 'Timetable photo',
    timetable_photo_y: 'Timetable photo',
    timetable_photo_zoom: 'Timetable photo',
};
// Where one column name means different things per table.
const ENTITY_LABELS = {
    classes: { name: 'Class Name' },
    rooms: { name: 'Room Name', price: 'Price per hour' },
    venues: { name: 'Studio name', address: 'Address', map_url: 'Map link', rent_per_hour: 'Rent per hour', active: 'In use' },
};
export const fieldLabel = (column, entity) => ENTITY_LABELS[entity]?.[column] ?? FIELD_LABELS[column] ?? column.replace(/_/g, ' ');

// Status words per table (database values → English keys).
const STATUS_LABELS = {
    bookings: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled', completed: 'Completed' },
    instructor_attendance: { pending: 'Pending', waiting: 'Waiting', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' },
    student_attendance: { pending: 'Not marked', attend: 'Attended', absent: 'Absent' },
    tuition_invoices: { unpaid: 'Unpaid', paid: 'Paid', waived: 'Waived', void: 'Cancelled' },
    bank_transfers: { unmatched: 'Unmatched', matched: 'Matched', ignored: 'Ignored' },
    payslips: { finalized: 'Finalized', paid: 'Paid' },
};
const DEPOSIT_LABELS = { waiting: 'Waiting', completed: 'Completed', cancelled: 'Cancelled' };

const MONEY = new Set(['deposit', 'full_payment', 'real_income', 'bank_transfer', 'cash', 'price', 'amount', 'paid_amount', 'session_pay', 'base_salary',
    'monthly_salary', 'bonuses', 'deductions', 'total', 'session_rate', 'default_session_rate', 'rent_per_hour']);
const DATES = new Set(['date', 'starts_on', 'ended_on', 'joined_at', 'leaves_after', 'due_date', 'spent_on', 'ends_on', 'date_of_birth']);
const STAMPS = new Set(['checkin_at', 'checkout_at', 'paid_at', 'finalized_at', 'received_at']);
const FILES = new Set(['image_path', 'avatar_path', 'receipt_path', 'timetable_photo_path']);
// A picture's position (0–100) and the timetable photo's zoom are percents.
const PERCENTS = new Set(['image_pos_x', 'image_pos_y', 'timetable_photo_x', 'timetable_photo_y', 'timetable_photo_zoom']);
const PEOPLE = new Set(['instructor_id', 'guest_id', 'student_id', 'profile_id']);

// One value of `changes`, readable: money in VND, dates, times, statuses and names translated.
export function formatValue(column, value, entity, fmt) {
    const { t, tn } = fmt;
    if (value === null || value === undefined || value === '') return '—';
    if (MONEY.has(column)) return formatVnd(value);
    if (DATES.has(column)) return fmt.formatDate(value, 'shortYear');
    if (column === 'month') return fmt.monthName(value, { withYear: true });
    if (column === 'start_time' || column === 'end_time') return formatTime(value);
    if (STAMPS.has(column)) return `${fmt.formatDate(studioDateOf(value), 'short')} ${formatClock(value)}`;
    if (FILES.has(column)) return t('Uploaded');
    if (PERCENTS.has(column)) return `${value}%`;
    if (column === 'image_paths') return tn(value.length, '{count} photo', '{count} photos');
    if (PEOPLE.has(column)) return fmt.people?.get(value)?.name || '—';
    if (column === 'room_id') return fmt.rooms?.get(value) ?? `#${value}`;
    if (column === 'venue_id') return fmt.venues?.get(value) ?? `#${value}`;
    if (column === 'class_id' || column === 'switched_from') return fmt.classes?.get(value) ?? `#${value}`;
    if (column === 'day_of_week') return fmt.dayName(value);
    if (column === 'role') return t(ROLE_LABELS[value] ?? value);
    if (column === 'method') return t(METHOD_LABELS[value] ?? value);
    if (column === 'renewal') return t(RENEWAL[value]?.label ?? value);
    if (column === 'void_reason') return t(VOID_REASONS[value] ?? value);
    if (column === 'category') return t(categoryOf(value).label);
    if (column === 'level') return t(levelOf(value).label);
    if (column === 'deposit_status') return t(DEPOSIT_LABELS[value] ?? value);
    if (column === 'status') return t(STATUS_LABELS[entity]?.[value] ?? value);
    if (typeof value === 'boolean') return t(value ? 'Yes' : 'No');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

// `changes` → [{ column, label, from, to }] (formatted), in the table's own order.
export function changeRows(row, fmt) {
    return Object.entries(row.changes ?? {}).map(([column, { from, to }]) => ({
        column,
        label: fmt.t(fieldLabel(column, row.entity)),
        from: formatValue(column, from, row.entity, fmt),
        to: formatValue(column, to, row.entity, fmt),
    }));
}

// "Price, Room" — the fields an edit touched (for the one-line facts).
export function changedFields(row, fmt) {
    const columns = Object.keys(row.changes ?? {});
    if (!columns.length) return '';
    const labels = [...new Set(columns.map((column) => fmt.t(SUMMARY_LABELS[column] ?? fieldLabel(column, row.entity))))];
    return labels.length > 3 ? fmt.t('{fields} and {count} more', { fields: labels.slice(0, 2).join(', '), count: labels.length - 2 }) : labels.join(', ');
}

// Where the record lives: { to, page (English key) } or { to, className } — null when it's gone.
export function recordLink(row, lookups) {
    const classId = row.class_id;
    const classExists = classId && lookups?.classes?.has(classId);
    const inClass = (tab, extra) => (classExists ? { to: classPath(classId, { tab, ...extra }), className: lookups.classes.get(classId) } : null);
    switch (row.entity) {
        case 'bookings':
            // The bookings page opens that booking's dialog, on its week in the calendar.
            if (row.action === 'deleted') return null;
            return { to: `/admin/bookings?booking=${row.entity_id}${row.meta?.date ? `&date=${row.meta.date}` : ''}`, page: 'Bookings' };
        case 'booking_settings':
            // The cancellation policy opens over its card, beside the room prices.
            return { to: '/admin/bookings?view=rooms&policy=1', page: 'Rooms & prices' };
        case 'classes':
            return inClass('overview');
        case 'class_schedules':
            return inClass('setup');
        case 'class_lessons':
            return inClass('routines');
        case 'class_students':
            return inClass('students');
        case 'instructor_attendance':
        case 'student_attendance':
            return inClass('sessions', row.meta?.date ? { day: row.meta.date } : undefined);
        case 'studio':
            // A day the studio was closed: the Attendance calendar on that day.
            return row.meta?.date ? { to: `/admin/attendance?day=${row.meta.date}`, page: 'Attendance' } : null;
        case 'tuition_invoices':
            return inClass('tuition') ?? { to: '/admin/tuition', page: 'Tuition' };
        case 'class_pay_rates':
            return inClass('money') ?? { to: '/admin/payroll', page: 'Payroll' };
        case 'site_settings':
            // The website timetable's look is picked above the directory's weekly timetable.
            return { to: '/admin/classes?view=timetable', page: 'Classes' };
        case 'bank_transfers':
        case 'tuition_settings':
            return { to: '/admin/tuition', page: 'Tuition' };
        case 'expenses':
        case 'recurring_expenses':
            return { to: '/admin/expenses', page: 'Expenses' };
        case 'payslips':
        case 'payroll_adjustments':
        case 'staff_salaries':
        case 'payroll_settings':
            return { to: '/admin/payroll', page: 'Payroll' };
        case 'rooms':
        case 'venues':
            // Rooms and their prices, and the rented studios under them: the bookings page's "Rooms & prices" view.
            return ['deleted', 'venue_removed'].includes(row.action) ? null : { to: '/admin/bookings?view=rooms', page: 'Rooms & prices' };
        case 'profiles':
            return row.subject_id && lookups?.people?.has(row.subject_id) ? { to: `/admin/users?person=${row.subject_id}`, page: 'Users' } : null;
        default:
            return null;
    }
}
