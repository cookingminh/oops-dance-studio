import { addDays, format, parseISO } from 'date-fns';
import {
    LuBanknote,
    LuCalendarDays,
    LuClipboardCheck,
    LuDoorOpen,
    LuGraduationCap,
    LuListChecks,
    LuMusic,
    LuReceipt,
    LuSettings,
    LuTicket,
    LuUsers,
    LuWallet,
} from 'react-icons/lu';
import { ACTIVITY_AREAS } from '@/services/activity';

// Pure helpers for the Activity page (/admin/activity): areas and actions, the period, the URL
// filters, day groups and collapsing bursts. Labels are English i18n keys.

const STUDIO_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const STUDIO_OFFSET = '+07:00'; // Vietnam has no daylight saving time
const studioDay = new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// timestamptz → the studio's calendar date 'yyyy-MM-dd'.
export const studioDateOf = (timestamp) => studioDay.format(new Date(timestamp));
export const shiftDay = (isoDate, days) => format(addDays(parseISO(isoDate), days), 'yyyy-MM-dd');
const startOf = (isoDate) => `${isoDate}T00:00:00${STUDIO_OFFSET}`;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Each area keeps one icon and one colour (the colour is never the only signal: the icon and the
// name come with it). `tone` picks the colour in activity.scss.
export const AREAS = {
    bookings: { label: 'Bookings', icon: LuTicket },
    classes: { label: 'Classes', icon: LuCalendarDays },
    routines: { label: 'Routines', icon: LuMusic },
    students: { label: 'Students', icon: LuGraduationCap },
    sessions: { label: 'Class sessions', icon: LuClipboardCheck },
    roll_call: { label: 'Roll call', icon: LuListChecks },
    tuition: { label: 'Tuition', icon: LuReceipt },
    expenses: { label: 'Expenses', icon: LuBanknote },
    payroll: { label: 'Payroll', icon: LuWallet },
    rooms: { label: 'Rooms', icon: LuDoorOpen },
    users: { label: 'Accounts', icon: LuUsers },
    settings: { label: 'Settings', icon: LuSettings },
};
export const AREA_KEYS = ACTIVITY_AREAS.filter((key) => key in AREAS);
export const areaOf = (key) => AREAS[key] ?? AREAS.settings;

// The "Action type" filter: every action of an area, with a short label.
export const ACTIONS = {
    bookings: {
        created: 'Requested',
        approved: 'Approved',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
        completed: 'Completed',
        reopened: 'Back to pending',
        payment_updated: 'Payment updated',
        paid: 'Payment received',
        refunded: 'Refunded',
        refund_changed: 'Refund changed',
        payment_removed: 'Payment removed',
        price_changed: 'Price changed',
        refund_policy: 'Cancellation policy',
        updated: 'Edited',
        deleted: 'Deleted',
    },
    classes: {
        created: 'Created',
        updated: 'Edited',
        ended: 'Ended',
        reopened: 'Reopened',
        instructor_changed: 'Instructor changed',
        deleted: 'Deleted',
        schedule_added: 'Weekly session added',
        schedule_changed: 'Weekly session moved',
        schedule_removed: 'Weekly session removed',
    },
    routines: {
        planned: 'Planned',
        updated: 'Edited',
        deleted: 'Deleted',
        video_added: 'Video added',
        video_changed: 'Video changed',
        video_removed: 'Video removed',
        promo_added: 'Promo uploaded',
        promo_changed: 'Promo replaced',
        promo_caption: 'Promo line edited',
        promo_removed: 'Promo removed',
    },
    students: { enrolled: 'Enrolled', removed: 'Left the class', leaving: 'Set to leave', staying: 'Staying on', updated: 'Edited' },
    sessions: {
        checked_in: 'Checked in',
        checked_out: 'Checked out',
        approved: 'Approved',
        cancelled: 'Cancelled',
        reopened: 'Reopened',
        substituted: 'Substitute',
        note: 'Note',
        make_up_added: 'Make-up added',
        make_up_removed: 'Make-up removed',
        day_closed: 'Studio closed for a day',
        check_edited: 'Check-in times corrected',
    },
    roll_call: { attended: 'Attended', absent: 'Absent', unmarked: 'Unmarked', note: 'Note' },
    tuition: {
        paid: 'Payment received',
        payment_undone: 'Payment undone',
        waived: 'Waived',
        reopened: 'Reopened',
        cancelled: 'Cancelled',
        amount_changed: 'Amount changed',
        renewal: 'Renewal answer',
        note: 'Note',
        transfer_unmatched: 'Unmatched transfer',
        transfer_assigned: 'Transfer assigned',
        transfer_ignored: 'Transfer ignored',
        transfer_reopened: 'Transfer back in the inbox',
        extra_moved: 'Extra money moved',
        extra_refunded: 'Extra money given back',
        extra_move_undone: 'Extra money taken back',
    },
    expenses: {
        created: 'Added',
        updated: 'Edited',
        deleted: 'Deleted',
        receipt_added: 'Receipt added',
        receipt_removed: 'Receipt removed',
        recurring_created: 'Recurring cost added',
        recurring_updated: 'Recurring cost edited',
        recurring_paused: 'Recurring cost paused',
        recurring_resumed: 'Recurring cost resumed',
        recurring_deleted: 'Recurring cost deleted',
    },
    payroll: {
        payslip_finalized: 'Payslip finalized',
        payslip_paid: 'Payslip paid',
        payslip_unpaid: 'Payslip unpaid',
        payslip_reopened: 'Payslip reopened',
        bonus_added: 'Bonus',
        deduction_added: 'Deduction',
        adjustment_changed: 'Adjustment changed',
        adjustment_removed: 'Adjustment removed',
        salary_set: 'Salary set',
        salary_removed: 'Salary removed',
        rate_set: 'Pay rate set',
        rate_removed: 'Pay rate removed',
    },
    rooms: {
        created: 'Added',
        updated: 'Edited',
        photos_changed: 'Photos changed',
        deleted: 'Deleted',
        venue_added: 'Rented studio added',
        venue_changed: 'Rented studio edited',
        venue_removed: 'Rented studio deleted',
    },
    users: { account_created: 'Account created', account_deleted: 'Account deleted', role_changed: 'Role changed', profile_edited: 'Details edited' },
    settings: { updated: 'Changed' },
};
export const actionLabel = (area, action) => ACTIONS[area]?.[action] ?? action;

// ---- Period --------------------------------------------------------------------------

export const PERIODS = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'week', label: 'Last 7 days' },
    { key: 'month', label: 'This month' },
    { key: 'custom', label: 'Custom' },
];
const DEFAULT_PERIOD = 'week';
// The log keeps 400 days.
export const OLDEST_DAYS = 400;

// The period from the URL: ?period=today|yesterday|week|month, or ?from=&to= (dates, inclusive),
// or ?days=N (the last N days, for links from other pages). Default: the last 7 days.
// → { key, fromDate, toDate, from, to (ISO timestamps, `to` exclusive), includesToday }.
export function periodRange(params, today) {
    const oldest = shiftDay(today, -OLDEST_DAYS);
    const clamp = (date) => (date > today ? today : date < oldest ? oldest : date);
    let key = params.get('period');
    let fromDate;
    let toDate = today;
    const from = params.get('from');
    const to = params.get('to');
    const days = Number(params.get('days'));

    if (key === 'today') fromDate = today;
    else if (key === 'yesterday') fromDate = toDate = shiftDay(today, -1);
    else if (key === 'month') fromDate = `${today.slice(0, 8)}01`;
    else if (ISO_DATE.test(from ?? '') || ISO_DATE.test(to ?? '')) {
        key = 'custom';
        toDate = clamp(ISO_DATE.test(to ?? '') ? to : today);
        fromDate = clamp(ISO_DATE.test(from ?? '') ? from : toDate);
        if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
    } else if (Number.isInteger(days) && days > 0) {
        key = 'custom';
        fromDate = clamp(shiftDay(today, -(Math.min(days, OLDEST_DAYS) - 1)));
    } else {
        key = DEFAULT_PERIOD;
        fromDate = shiftDay(today, -6);
    }
    return { key, fromDate, toDate, from: startOf(fromDate), to: startOf(shiftDay(toDate, 1)), includesToday: toDate >= today };
}

// ---- URL filters ---------------------------------------------------------------------

// ?person= (a profile id, or 'system') · ?subject= (who it happened to) · ?area= · ?action= ·
// ?q= (names and labels) · ?class= (a class id).
export function readFilters(params) {
    const area = AREA_KEYS.includes(params.get('area')) ? params.get('area') : null;
    const action = area && params.get('action') in (ACTIONS[area] ?? {}) ? params.get('action') : null;
    return {
        person: params.get('person') || null,
        subject: params.get('subject') || null,
        area,
        action,
        q: params.get('q') ?? '',
        classId: Number(params.get('class')) || null,
    };
}

export const hasFilters = (filters) => Boolean(filters.person || filters.subject || filters.area || filters.q.trim() || filters.classId);

// Filters + period → listActivity()'s arguments.
export function feedQuery(filters, range) {
    return {
        from: range.from,
        to: range.to,
        actorId: filters.person ?? undefined,
        subjectId: filters.subject ?? undefined,
        areas: filters.area ? [filters.area] : undefined,
        actions: filters.action ? [filters.action] : undefined,
        classId: filters.classId ?? undefined,
        search: filters.q.trim() || undefined,
    };
}

// The params to drop when the period changes (so one period never mixes with another's).
export const PERIOD_PARAMS = ['period', 'from', 'to', 'days'];

// ---- Bursts and days -----------------------------------------------------------------

// Entries by the same person (or the system) about the same thing that follow each other within
// half an hour read as one row: a roll call, payslips for one month, a class set up with its
// weekly sessions, routine and students.
const BURST_GAP = 30 * 60 * 1000;
const CLASS_SETUP = new Set(['classes.created', 'classes.schedule_added', 'routines.planned', 'students.enrolled']);

function burstKey(row) {
    const what = `${row.area}.${row.action}`;
    // A check-in correction carries its own reason: it is never folded into a run.
    if (what === 'sessions.check_edited') return `single|${row.id}`;
    if (row.area === 'roll_call') return `roll|${row.class_id}|${row.meta?.date ?? ''}`;
    if (CLASS_SETUP.has(what) && row.class_id) return `class|${row.class_id}`;
    return `${what}|${row.class_id ?? ''}|${row.meta?.date ?? row.meta?.month ?? ''}`;
}

// Rows (newest first) → items: { kind: 'entry', row } or { kind: 'burst', rows } (newest first),
// each with `id`, `at` (its newest time) and `date` (studio day). A burst may skip over other
// people's entries in between; it stays inside one day.
export function collapse(rows) {
    const items = [];
    const open = new Map();
    for (const row of rows) {
        const date = studioDateOf(row.at);
        const key = `${row.actor_id ?? 'system'}|${burstKey(row)}`;
        const group = open.get(key);
        if (group && group.date === date && Date.parse(group.rows.at(-1).at) - Date.parse(row.at) <= BURST_GAP) {
            group.rows.push(row);
            continue;
        }
        const item = { key, date, rows: [row], at: row.at };
        open.set(key, item);
        items.push(item);
    }
    return items.map((item) =>
        item.rows.length > 1
            ? { kind: 'burst', id: `burst-${item.rows.at(-1).id}`, rows: item.rows, at: item.at, date: item.date }
            : { kind: 'entry', id: `entry-${item.rows[0].id}`, row: item.rows[0], at: item.at, date: item.date }
    );
}

// Items → [{ date, items, count (rows) }], newest day first.
export function groupByDay(items) {
    const days = [];
    for (const item of items) {
        let day = days.at(-1);
        if (!day || day.date !== item.date) {
            day = { date: item.date, items: [], count: 0 };
            days.push(day);
        }
        day.items.push(item);
        day.count += item.kind === 'burst' ? item.rows.length : 1;
    }
    return days;
}

// The person a row is about is the one who did it (a guest booking, a student answering).
export const isSelf = (row) => Boolean(row.actor_id && row.actor_id === row.subject_id);
