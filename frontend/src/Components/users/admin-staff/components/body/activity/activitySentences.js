import { formatTime, formatVnd } from '@/lib/format';
import { categoryOf } from '@/lib/expenseCategories';
import { VOID_REASONS } from '../tuition/tuitionModel';
import { ROLE_LABELS, changedFields } from './activityFields';
import { actionLabel, areaOf, isSelf } from './activityModel';

// One readable sentence per log row (and per collapsed burst): an English i18n key with
// {placeholders}, the values for them and a few short facts (already translated).
//   describe(row, fmt) / describeBurst(rows, fmt) → { key, vars, facts }
// `fmt` = { t, tn, formatDate, dayName, monthName, people } (see useActivityFormat).
// The meta keys each area carries are listed in services/activity.js.

const day = (fmt, date) => (date ? fmt.formatDate(date, 'short') : '');
const span = (start, end) => (start ? (end ? `${formatTime(start)}–${formatTime(end)}` : formatTime(start)) : '');
const when = (fmt, date, start, end) => [day(fmt, date), span(start, end)].filter(Boolean).join(' · ');
const money = (value) => (value === null || value === undefined ? '' : formatVnd(value));
const quote = (text) => (text ? `“${text}”` : '');
const change = (from, to) => (from !== null && from !== undefined && from !== to ? `${from} → ${to}` : to);
const slot = (fmt, value) => (value?.day ? `${fmt.dayName(value.day, 'short')} ${span(value.start, value.end)}` : '');
const fieldsFact = (row, fmt) => {
    const fields = changedFields(row, fmt);
    return fields ? fmt.t('Changed: {fields}', { fields }) : '';
};

// Who did it, as they were called then.
export const actorName = (row, fmt) => row.actor_name || fmt.people?.get(row.actor_id)?.name || fmt.t('Someone');

// ---- One row ------------------------------------------------------------------------------

const BOOKINGS = (row, fmt) => {
    const m = row.meta ?? {};
    const facts = [m.room, when(fmt, m.date, m.start, m.end)];
    const amount = money(Math.abs(Number(m.received ?? 0)));
    const keys = {
        created: isSelf(row) ? '{actor} asked to book a room' : '{actor} booked a room for {name}',
        approved: '{actor} approved {name}’s booking',
        rejected: '{actor} rejected {name}’s booking',
        cancelled: isSelf(row) ? '{actor} cancelled their booking' : '{actor} cancelled {name}’s booking',
        completed: '{actor} marked {name}’s booking as completed',
        reopened: '{actor} set {name}’s booking back to pending',
        payment_updated: '{actor} updated the payment on {name}’s booking',
        updated: '{actor} edited {name}’s booking',
        deleted: '{actor} deleted {name}’s booking',
        // Money on a booking (booking payments RPCs): the bank (no actor) or a staff member.
        paid: !row.actor_id || m.bank
            ? 'Bank transfer of {amount} received for {name}’s booking'
            : m.method === 'transfer'
                ? '{actor} recorded a {amount} transfer for {name}’s booking'
                : '{actor} recorded {amount} cash for {name}’s booking',
        refunded: '{actor} refunded {amount} to {name}',
        payment_removed: '{actor} removed a {amount} payment from {name}’s booking',
        price_changed: '{actor} changed {name}’s booking price {from} → {to}',
    };
    if (row.action === 'updated') facts.push(fieldsFact(row, fmt));
    if (['paid', 'refunded', 'payment_removed'].includes(row.action)) {
        facts.unshift(m.method === 'cash' ? fmt.t('Cash') : fmt.t('Bank transfer'));
        facts.push(quote(m.note));
    }
    if (row.action === 'price_changed') facts.unshift(quote(m.note));
    return keys[row.action] && { key: keys[row.action], vars: { amount, from: money(m.from), to: money(m.to) }, facts };
};

const CLASSES = (row, fmt) => {
    const m = row.meta ?? {};
    const out = {
        created: ['{actor} created the class {class}', [m.instructor && fmt.t('Taught by {name}', { name: m.instructor })]],
        updated: ['{actor} edited the class {class}', [fieldsFact(row, fmt)]],
        ended: ['{actor} ended the class {class}', [m.last_day && fmt.t('Last day {date}', { date: day(fmt, m.last_day) }), quote(m.reason)]],
        reopened: ['{actor} reopened the class {class}', []],
        instructor_changed: ['{actor} changed the instructor of {class}', [change(m.from ?? '—', m.instructor ?? '—')]],
        deleted: ['{actor} deleted the class {class}', []],
        schedule_added: ['{actor} added a weekly session to {class}', [slot(fmt, m)]],
        schedule_changed: ['{actor} moved a weekly session of {class}', [change(slot(fmt, m.from), slot(fmt, m))]],
        schedule_removed: ['{actor} removed a weekly session from {class}', [slot(fmt, m)]],
    }[row.action];
    return out && { key: out[0], vars: { class: row.label }, facts: out[1] };
};

const ROUTINES = (row, fmt) => {
    const m = row.meta ?? {};
    const keys = {
        planned: '{actor} planned the routine {title} for {class}',
        updated: '{actor} edited the routine {title}',
        deleted: '{actor} deleted the routine {title}',
        video_added: '{actor} added the video for {title}',
        video_changed: '{actor} changed the video for {title}',
        video_removed: '{actor} removed the video for {title}',
        promo_added: '{actor} uploaded the promo for {title}',
        promo_changed: '{actor} replaced the promo for {title}',
        promo_caption: '{actor} edited the promo line for {title}',
        promo_removed: '{actor} removed the promo for {title}',
    };
    let facts;
    if (row.action === 'planned') {
        facts = [m.starts_on && fmt.t('Starts {date}', { date: day(fmt, m.starts_on) }), m.sessions && fmt.tn(m.sessions, '{count} session', '{count} sessions'), money(m.price)];
    } else if (row.action.startsWith('promo_')) {
        // The teacher's line is their words: shown as written.
        facts = [m.class, m.caption && row.action !== 'promo_removed' ? `“${m.caption}”` : ''];
    } else {
        facts = [m.class, row.action === 'updated' ? fieldsFact(row, fmt) : ''];
    }
    return keys[row.action] && { key: keys[row.action], facts };
};

const STUDENTS = (row, fmt) => {
    const m = row.meta ?? {};
    const keys = {
        enrolled: isSelf(row) ? '{actor} joined {class}' : '{actor} added {name} to {class}',
        removed: row.actor_id ? '{actor} removed {name} from {class}' : '{name} left {class} after their course',
        leaving: '{actor} set {name} to leave {class}',
        staying: '{actor} kept {name} in {class}',
        updated: '{actor} updated {name}’s place in {class}',
    };
    const facts = {
        enrolled: [m.joined_at && fmt.t('From {date}', { date: day(fmt, m.joined_at) })],
        leaving: [m.leaves_after && fmt.t('Leaves after {date}', { date: day(fmt, m.leaves_after) })],
        updated: [fieldsFact(row, fmt)],
    }[row.action];
    return keys[row.action] && { key: keys[row.action], facts };
};

const SESSIONS = (row, fmt) => {
    const m = row.meta ?? {};
    const at = when(fmt, m.date, m.start);
    const makeUp = m.make_up ? fmt.t('Make-up') : '';
    const out = {
        checked_in: [isSelf(row) || !row.subject_id ? '{actor} checked in to {class}' : '{actor} checked {name} in to {class}', [at, makeUp]],
        checked_out: ['{actor} checked out of {class}', [at, makeUp]],
        approved: ['{actor} approved {name}’s session of {class}', [at, makeUp]],
        cancelled: ['{actor} cancelled the {class} session', [at, quote(m.note)]],
        reopened: ['{actor} reopened the {class} session', [at]],
        substituted: ['{actor} made {name} the substitute for {class}', [at, m.from && fmt.t('Instead of {name}', { name: m.from })]],
        note: ['{actor} added a note to the {class} session', [at, quote(m.note)]],
        make_up_added: ['{actor} added a make-up session for {class}', [at, m.instructor]],
        make_up_removed: ['{actor} removed a make-up session of {class}', [at]],
    }[row.action];
    return out && { key: out[0], vars: { class: row.label, name: m.instructor ?? fmt.t('someone') }, facts: out[1] };
};

const ROLL_CALL = (row, fmt) => {
    const m = row.meta ?? {};
    const keys = {
        attended: '{actor} marked {name} present in {class}',
        absent: '{actor} marked {name} absent in {class}',
        unmarked: '{actor} cleared {name}’s roll call in {class}',
        note: '{actor} added a note on {name}’s roll call in {class}',
    };
    return keys[row.action] && { key: keys[row.action], facts: [day(fmt, m.date), quote(m.note)] };
};

const TUITION = (row, fmt) => {
    const m = row.meta ?? {};
    const course = [m.class, m.course];
    const transfer = [money(m.amount), quote(row.label)];
    const paidKey = !row.actor_id
        ? 'Bank transfer received from {name}'
        : m.method === 'cash'
            ? '{actor} recorded a cash payment from {name}'
            : m.method === 'transfer'
                ? '{actor} recorded a bank transfer from {name}'
                : '{actor} recorded a payment from {name}';
    const renewalKey = isSelf(row)
        ? m.renewal === 'stop'
            ? '{actor} will stop {class} after this course'
            : '{actor} will continue in {class}'
        : m.renewal === 'stop'
            ? '{actor} noted that {name} will stop {class}'
            : '{actor} noted that {name} will continue in {class}';
    const out = {
        paid: [paidKey, [money(m.received ?? m.paid), ...course]],
        payment_undone: ['{actor} undid a payment from {name}', course],
        waived: ['{actor} waived {name}’s tuition', [...course, quote(m.note)]],
        reopened: ['{actor} reopened {name}’s invoice', course],
        cancelled: [
            row.actor_id ? '{actor} cancelled {name}’s invoice for {class}' : '{name}’s invoice for {class} was cancelled',
            [m.reason && fmt.t(VOID_REASONS[m.reason] ?? m.reason), m.course],
        ],
        amount_changed: ['{actor} changed the amount on {name}’s invoice', [change(money(m.from), money(m.amount)), quote(m.note)]],
        renewal: [renewalKey, [m.course]],
        note: [m.note ? '{actor} added a note to {name}’s invoice' : '{actor} removed the note from {name}’s invoice', [quote(m.note), ...course]],
        transfer_unmatched: ['A bank transfer couldn’t be matched to an invoice', transfer],
        // No invoice on an assigned transfer: staff put it on a room booking.
        transfer_assigned: [m.invoice_id ? '{actor} matched a bank transfer to {name}' : '{actor} matched a bank transfer to a room booking', transfer],
        transfer_ignored: ['{actor} ignored a bank transfer', transfer],
        transfer_reopened: ['{actor} put a bank transfer back in the inbox', transfer],
    }[row.action];
    const name = row.action.startsWith('transfer_') ? m.student ?? fmt.t('a student') : row.label;
    return out && { key: out[0], vars: { name }, facts: out[1] };
};

const EXPENSES = (row, fmt) => {
    const m = row.meta ?? {};
    const keys = {
        created: '{actor} added the expense {title}',
        updated: '{actor} edited the expense {title}',
        deleted: '{actor} deleted the expense {title}',
        receipt_added: '{actor} attached a receipt to {title}',
        receipt_removed: '{actor} removed the receipt from {title}',
        recurring_created: '{actor} added the recurring cost {title}',
        recurring_updated: '{actor} edited the recurring cost {title}',
        recurring_paused: '{actor} paused the recurring cost {title}',
        recurring_resumed: '{actor} resumed the recurring cost {title}',
        recurring_deleted: '{actor} deleted the recurring cost {title}',
    };
    const recurring = row.action.startsWith('recurring_');
    const facts = [
        money(m.amount),
        m.category && fmt.t(categoryOf(m.category).label),
        m.class,
        recurring ? m.day && fmt.t('Day {day} of each month', { day: m.day }) : day(fmt, m.spent_on),
        row.action.endsWith('updated') ? fieldsFact(row, fmt) : '',
    ];
    return keys[row.action] && { key: keys[row.action], facts };
};

const PAYROLL = (row, fmt) => {
    const m = row.meta ?? {};
    const month = m.month ? fmt.monthName(m.month) : '';
    const adjustment = [money(m.amount), month, quote(m.reason)];
    const out = {
        payslip_finalized: ['{actor} finalized {name}’s payslip for {month}', [money(m.total)]],
        payslip_paid: ['{actor} paid {name}’s payslip for {month}', [money(m.total)]],
        payslip_unpaid: ['{actor} marked {name}’s payslip for {month} as unpaid', [money(m.total)]],
        payslip_reopened: ['{actor} reopened {name}’s payslip for {month}', [money(m.total)]],
        bonus_added: ['{actor} added a bonus for {name}', adjustment],
        deduction_added: ['{actor} added a deduction for {name}', adjustment],
        adjustment_changed: ['{actor} changed an adjustment for {name}', adjustment],
        adjustment_removed: ['{actor} removed an adjustment for {name}', adjustment],
        salary_set: ['{actor} set {name}’s monthly salary', [change(money(m.from), money(m.salary))]],
        salary_removed: ['{actor} removed {name}’s monthly salary', [money(m.salary)]],
        rate_set: ['{actor} set the pay per session for {class}', [change(money(m.from), money(m.rate))]],
        rate_removed: ['{actor} reset the pay per session for {class}', [fmt.t('Back to the default rate')]],
    }[row.action];
    return out && { key: out[0], vars: { month, class: row.label }, facts: out[1] };
};

const ROOMS = (row, fmt) => {
    const m = row.meta ?? {};
    const keys = {
        created: '{actor} added the room {title}',
        updated: '{actor} edited the room {title}',
        photos_changed: '{actor} changed the photos of {title}',
        deleted: '{actor} deleted the room {title}',
    };
    const facts = row.action === 'updated' ? [fieldsFact(row, fmt)] : [m.size, m.price && fmt.t('{price} per hour', { price: money(m.price) })];
    return keys[row.action] && { key: keys[row.action], facts };
};

const USERS = (row, fmt) => {
    const m = row.meta ?? {};
    const role = (value) => (value ? fmt.t(ROLE_LABELS[value] ?? value) : '—');
    const out = {
        account_created: [row.actor_id && !isSelf(row) ? '{actor} created an account for {name}' : '{name} signed up', [m.role && role(m.role)]],
        account_deleted: [row.actor_id ? '{actor} deleted {name}’s account' : '{name}’s account was deleted', [m.email]],
        role_changed: ['{actor} changed {name}’s role', [change(role(m.from), role(m.role))]],
        profile_edited: ['{actor} edited {name}’s details', [fieldsFact(row, fmt)]],
    }[row.action];
    return out && { key: out[0], facts: out[1] };
};

const SETTINGS = (row, fmt) =>
    row.action === 'updated' && {
        key: row.label === 'Payroll' ? '{actor} changed the payroll settings' : '{actor} changed the tuition settings',
        facts: [fieldsFact(row, fmt)],
    };

const AREA_SENTENCES = {
    bookings: BOOKINGS,
    classes: CLASSES,
    routines: ROUTINES,
    students: STUDENTS,
    sessions: SESSIONS,
    roll_call: ROLL_CALL,
    tuition: TUITION,
    expenses: EXPENSES,
    payroll: PAYROLL,
    rooms: ROOMS,
    users: USERS,
    settings: SETTINGS,
};

export function describe(row, fmt) {
    const base = { actor: actorName(row, fmt), name: row.label || fmt.t('someone'), title: row.label, class: row.meta?.class ?? row.label };
    const out = AREA_SENTENCES[row.area]?.(row, fmt) || {
        key: row.actor_id ? '{actor} made a change: {action}' : 'A change: {action}',
        facts: [fmt.t(areaOf(row.area).label)],
    };
    return {
        key: out.key,
        vars: { ...base, action: fmt.t(actionLabel(row.area, row.action)), ...out.vars },
        facts: (out.facts ?? []).filter(Boolean),
    };
}

// ---- A burst (same person, same thing, within half an hour) ---------------------------------

const sumOf = (rows, key) => rows.reduce((total, row) => total + Number(row.meta?.[key] ?? 0), 0);

// Same action, several times: '<area>.<action>' → (rows, fmt, system) → { key, facts }.
const PLURALS = {
    'bookings.created': () => ({ key: '{actor} made {count} bookings' }),
    'bookings.approved': () => ({ key: '{actor} approved {count} bookings' }),
    'bookings.rejected': () => ({ key: '{actor} rejected {count} bookings' }),
    'bookings.cancelled': () => ({ key: '{actor} cancelled {count} bookings' }),
    'bookings.paid': (rows, fmt, system) => ({
        key: system ? '{count} bank transfers received for bookings' : '{actor} recorded {count} booking payments',
        facts: [fmt.t('{amount} in total', { amount: money(sumOf(rows, 'received')) })],
        vars: { amount: money(sumOf(rows, 'received')) },
    }),
    'classes.schedule_added': () => ({ key: '{actor} added {count} weekly sessions to {class}' }),
    'routines.planned': () => ({ key: '{actor} planned {count} routines for {class}' }),
    'students.enrolled': () => ({ key: '{actor} added {count} students to {class}' }),
    'students.removed': (rows, fmt, system) => ({ key: system ? '{count} students left {class} after their course' : '{actor} removed {count} students from {class}' }),
    'tuition.paid': (rows, fmt, system) => ({
        key: system ? '{count} bank transfers received' : '{actor} recorded {count} payments',
        facts: [fmt.t('{amount} in total', { amount: money(rows.reduce((total, row) => total + Number(row.meta?.received ?? row.meta?.paid ?? 0), 0)) })],
    }),
    'tuition.cancelled': (rows, fmt, system) => ({ key: system ? '{count} invoices were cancelled' : '{actor} cancelled {count} invoices' }),
    'tuition.waived': () => ({ key: '{actor} waived {count} invoices' }),
    'expenses.created': (rows, fmt) => ({ key: '{actor} added {count} expenses', facts: [fmt.t('{amount} in total', { amount: money(sumOf(rows, 'amount')) })] }),
    'payroll.payslip_finalized': (rows, fmt) => ({ key: '{actor} finalized {count} payslips for {month}', facts: [fmt.t('{amount} in total', { amount: money(sumOf(rows, 'total')) })] }),
    'payroll.payslip_paid': (rows, fmt) => ({ key: '{actor} paid {count} payslips for {month}', facts: [fmt.t('{amount} in total', { amount: money(sumOf(rows, 'total')) })] }),
    'users.account_created': (rows, fmt, system) => (system ? { key: '{count} people signed up' } : null),
};

// Each student counts once, with their latest mark (a mark changed twice is one student).
function rollCallBurst(rows, fmt) {
    const latest = new Map();
    for (const row of rows) if (row.action !== 'note' && !latest.has(row.subject_id ?? row.id)) latest.set(row.subject_id ?? row.id, row.action);
    const count = (action) => (action === 'note' ? rows.filter((row) => row.action === 'note').length : [...latest.values()].filter((value) => value === action).length);
    const parts = [
        count('attended') && fmt.tn(count('attended'), '{count} attended', '{count} attended'),
        count('absent') && fmt.tn(count('absent'), '{count} absent', '{count} absent'),
        count('unmarked') && fmt.tn(count('unmarked'), '{count} cleared', '{count} cleared'),
        count('note') && fmt.tn(count('note'), '{count} note', '{count} notes'),
    ].filter(Boolean);
    return { key: '{actor} took the roll call for {class} ({date}): {summary}', vars: { date: day(fmt, rows[0].meta?.date), summary: parts.join(', ') }, facts: [] };
}

function classSetupBurst(rows, fmt) {
    const count = (area, action) => rows.filter((row) => row.area === area && row.action === action).length;
    const created = rows.find((row) => row.area === 'classes' && row.action === 'created');
    if (!created) return { key: '{actor} made {count} changes to {class}', vars: { class: fmt.classes?.get(rows[0].class_id) ?? rows[0].meta?.class ?? rows[0].label } };
    const sessions = count('classes', 'schedule_added');
    const routines = count('routines', 'planned');
    const students = count('students', 'enrolled');
    return {
        key: '{actor} created the class {class}',
        vars: { class: created.label },
        facts: [
            sessions && fmt.tn(sessions, '{count} weekly session', '{count} weekly sessions'),
            routines && fmt.tn(routines, '{count} routine', '{count} routines'),
            students && fmt.tn(students, '{count} student', '{count} students'),
        ],
    };
}

export function describeBurst(rows, fmt) {
    const first = describe(rows[0], fmt);
    const system = !rows[0].actor_id;
    const sameAction = rows.every((row) => row.area === rows[0].area && row.action === rows[0].action);
    let out = null;
    if (rows[0].area === 'roll_call' && rows.some((row) => row.action !== 'note')) out = rollCallBurst(rows, fmt);
    else if (!sameAction) out = classSetupBurst(rows, fmt);
    else out = PLURALS[`${rows[0].area}.${rows[0].action}`]?.(rows, fmt, system) ?? null;
    if (!out) out = { key: system ? '{count} changes: {action}' : '{actor} made {count} changes: {action}' };
    // Facts every row shares (the date of a roll call, the room of a run of bookings…).
    const shared = first.facts.filter((fact) => rows.every((row) => describe(row, fmt).facts.includes(fact)));
    return {
        key: out.key,
        vars: { ...first.vars, count: rows.length, ...out.vars },
        facts: [...(out.facts ?? []), ...(out.facts ? [] : shared)].filter(Boolean),
    };
}
