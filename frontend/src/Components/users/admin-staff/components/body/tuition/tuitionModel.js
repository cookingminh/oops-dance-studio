import { amountDue, invoiceState } from '@/services/tuition';
import { routineState, routinesByClass } from '@/lib/lessons';
import { isSwitchedAway, isSwitchedIn } from '../../common/switch-class/switchNotes';

// Helpers for the staff tuition page: invoice states, the page's lists (to do, by class, search),
// money, courses, transfer suggestions and the CSV export. Labels are English i18n keys. Tuition is
// per COURSE (khoá): one invoice per student and course (class_lessons row), `month` = the month the
// course starts.

// What a row shows for each rowState(). `partial` counts as "due" in the totals.
// Colours: the validated status hues of chartTheme (green / blue / red / violet / pink) + a neutral.
export const STATES = {
    due: { label: 'Due', color: '#2a78d6' },
    partial: { label: 'Part paid', color: '#2a78d6' },
    overdue: { label: 'Overdue', color: '#e34948' },
    paid: { label: 'Paid', color: '#1baf7a' },
    waived: { label: 'Waived', color: '#6250d6' },
    void: { label: 'Cancelled', color: '#a1a1aa' },
    // Moved to another class (the money went with them): not a cancellation, not churn.
    switched: { label: 'Switched', color: '#e87ba4' },
};

export const VOID_REASONS = { stopped: 'Said stop', not_renewed: 'Didn’t renew', removed: 'Removed from the class', switched: 'Switched class', class_ended: 'Class ended' };
export const METHOD_LABELS = { cash: 'Cash', transfer: 'Bank transfer' };
export const RENEWAL = {
    continue: { label: 'Continuing', tone: 'yes' },
    stop: { label: 'Stopping', tone: 'no' },
    none: { label: 'No answer', tone: 'none' },
};

const isUnanswered = (invoice) => invoice.status === 'unpaid' && !invoice.renewal;

// invoiceState(), with the old class's invoice of a class switch as 'switched' (not 'void').
export const rowState = (invoice, today) => (isSwitchedAway(invoice) ? 'switched' : invoiceState(invoice, today));

// "tháng 11 năm 2026" → "Tháng 11 năm 2026" (a heading).
export const capitalizeFirst = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

// 'yyyy-MM-dd' → 'yyyy-MM-01'
export const monthOf = (isoDate) => `${isoDate.slice(0, 7)}-01`;

// The course an invoice pays for, with its progress (a listLessonProgress row) when known:
//   { id, title, starts_on, session_count, sessions_held, ends_on (last session), next_session, price,
//     phase: 'planned' (not started) | 'current' (running) | 'done' (finished, or its class ended) }
// Without a progress row (a class that has ended, or progress didn't load) the dates decide.
export function courseFacts(invoice, row, today) {
    const embedded = invoice.course ?? {};
    const startsOn = row?.starts_on ?? embedded.starts_on ?? invoice.month;
    let phase;
    if (row) phase = row.status === 'planned' ? 'planned' : row.status === 'current' ? 'current' : 'done';
    else if (today && startsOn > today) phase = 'planned';
    else phase = invoice.status === 'unpaid' || (today && invoice.month === monthOf(today)) ? 'current' : 'done';
    return {
        id: invoice.lesson_id,
        title: invoice.lesson_title || row?.title || embedded.title || '',
        starts_on: startsOn,
        session_count: row?.session_count ?? embedded.session_count ?? invoice.sessions ?? null,
        sessions_held: row?.sessions_held ?? null,
        ends_on: row?.ends_on ?? null,
        next_session: row?.next_session ?? null,
        price: embedded.price ?? null,
        phase,
    };
}

// Invoices with `course` = courseFacts() (progress rows by lesson id).
export const withCourses = (invoices, progressById, today) =>
    invoices.map((invoice) => ({ ...invoice, course: courseFacts(invoice, progressById.get(invoice.lesson_id), today) }));

// Paid for fewer sessions than the course has: someone new who joined after it started.
export const joinedLate = (invoice) =>
    invoice.sessions != null && invoice.course?.session_count != null && Number(invoice.sessions) < Number(invoice.course.session_count);

// The list price of an invoice's course: its own fee, else the class price.
export const coursePrice = (invoice) => invoice.course?.price ?? invoice.class?.price ?? null;

// Which actions an invoice allows (mirrors the tuition_* RPC rules, so nothing offered fails).
// `place`: the student's place in the invoice's class now ({ joined_at, leaves_after }), null when
// they aren't in it; a student already leaving (switch planned) can't be switched again.
// A course still open = not finished (invoice.course.phase from courseFacts); for rows without it,
// the older monthly rule (`thisMonth`: its month or later).
export function invoiceActions(invoice, place = null, thisMonth = null) {
    const unpaid = invoice.status === 'unpaid';
    const hasPaid = Number(invoice.paid_amount) > 0;
    const phase = invoice.course?.phase;
    const current = phase ? phase !== 'done' : thisMonth ? invoice.month >= thisMonth : true;
    const actions = { money: [], fix: [], renewal: [], move: [] };
    if (unpaid) actions.money.push('pay', 'code');
    if (hasPaid && (unpaid || invoice.status === 'paid')) actions.money.push('undo');
    if (unpaid) actions.fix.push('amount');
    if (unpaid && !hasPaid) actions.fix.push('waive');
    if (invoice.status === 'waived') actions.fix.push('reopen');
    if (invoice.status === 'void' && current && ['stopped', 'not_renewed'].includes(invoice.void_reason)) actions.fix.push('reopen');
    if (current && unpaid && invoice.renewal !== 'continue') actions.renewal.push('continue');
    if (current && unpaid && !hasPaid && invoice.renewal !== 'stop') actions.renewal.push('stop');
    if (place && !place.leaves_after && current && invoice.status !== 'void' && invoice.student_id && invoice.class_id) actions.move.push('switch');
    // A class switch's notes are written by the server and read back (switchNotes.js): not editable.
    if (!isSwitchedAway(invoice) && !isSwitchedIn(invoice)) actions.fix.push('note');
    return actions;
}

// Notes on an invoice: the server's "Joined after N of M sessions." (private.bill_course) comes first;
// what follows is staff's own words. { prefix, text }.
export const LATE_NOTE = /^Joined after (\d+) of (\d+) sessions\.\s*/;
export const NOTE_MAX = 300;

export function splitNote(invoice) {
    const note = invoice.note ?? '';
    const late = note.match(LATE_NOTE);
    return late ? { prefix: late[0].endsWith(' ') ? late[0] : `${late[0]} `, text: note.slice(late[0].length) } : { prefix: '', text: note };
}


// Whole days from `from` to `to` ('yyyy-MM-dd').
export const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// Lower case, no Vietnamese accents ("Nâng Cao" → "nang cao", "Đỗ" → "do").
export const fold = (text) =>
    String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();

// Words without accents; "K-pop" stays one word ("kpop"), as people type it in a bank app.
const words = (text) => fold(text).replace(/-/g, '').split(/[^a-z0-9]+/).filter(Boolean);

export function invoiceSearchText(invoice) {
    const student = invoice.student;
    return fold([invoice.student_name, student?.full_name, student?.username, student?.email, student?.contact_number, invoice.class_name, invoice.lesson_title, invoice.payment_code].join(' '));
}

// Money of a set of invoices (the running courses):
//   billed: unpaid + paid invoices (what they ask for, like the finance report)
//   collected: money received on them · owed: still due on unpaid ones · rate: collected / billed
export function moneyOf(invoices) {
    const money = { billed: 0, collected: 0, owed: 0 };
    for (const invoice of invoices) {
        if (invoice.status === 'unpaid' || invoice.status === 'paid') money.billed += Number(invoice.amount);
        money.collected += Number(invoice.paid_amount);
        if (invoice.status === 'unpaid') money.owed += amountDue(invoice);
    }
    return { ...money, rate: money.billed ? money.collected / money.billed : null };
}

// One course's renewal answers, per student: continuing (paid, waived or said yes), stopping
// (said stop, or cancelled) and no answer yet. A class switch isn't a stop: the old class's
// cancelled invoice is left out (the new class's invoice carries the answer).
export function renewalSummary(invoices) {
    const groups = { continue: [], none: [], stop: [] };
    let paid = 0;
    let total = 0;
    for (const invoice of invoices) {
        if (isSwitchedAway(invoice)) continue;
        total += 1;
        if (invoice.status === 'paid') paid += 1;
        if (invoice.status === 'void' || invoice.renewal === 'stop') groups.stop.push(invoice);
        else if (isUnanswered(invoice)) groups.none.push(invoice);
        else groups.continue.push(invoice);
    }
    return { ...groups, paid, total };
}

// Invoices an unmatched transfer is probably paying, best first (at most `limit`):
//   amount  the transfer is exactly what is still due
//   name    the student's name is in the content (all of it, or the given name + one more word)
//   class   most of the class name is in the content
//   code    most of the invoice code is in the content (a typo)
export function suggestInvoices(transfer, invoices, limit = 3) {
    const content = new Set(words(transfer.content));
    const compact = fold(transfer.content).replace(/[^a-z0-9]/g, '');
    const amount = Number(transfer.amount);
    return invoices
        .map((invoice) => {
            const reasons = [];
            let score = 0;
            const code = invoice.payment_code.slice(4).toLowerCase();
            if (compact.includes(code.slice(0, 5)) || compact.includes(code.slice(1))) {
                score += 5;
                reasons.push('code');
            }
            const name = words(invoice.student_name);
            const nameHits = name.filter((word) => content.has(word)).length;
            if (name.length && (nameHits === name.length || (nameHits >= 2 && content.has(name[name.length - 1])))) {
                score += 4;
                reasons.push('name');
            }
            if (amountDue(invoice) === amount) {
                score += 3;
                reasons.push('amount');
            }
            const cls = words(invoice.class_name).filter((word) => word.length > 1);
            const classHits = cls.filter((word) => content.has(word)).length;
            if (cls.length && classHits >= Math.min(2, cls.length)) {
                score += 2;
                reasons.push('class');
            }
            return { invoice, score, reasons };
        })
        .filter((match) => match.score >= 3)
        .sort((a, b) => b.score - a.score || a.invoice.due_date.localeCompare(b.invoice.due_date))
        .slice(0, limit);
}

export const REASON_LABELS = { code: 'Code almost matches', name: 'Name in the content', amount: 'Same amount', class: 'Class in the content' };

// CSV of the invoices on screen for the accountant (amounts in VND, no formatting); `name` goes in the
// file name ('running-2026-11-09', '2026-10'…). `Month` is the month the course starts (reports count it there).
export function downloadCsv(invoices, name, today, t) {
    const head = ['Student', 'Phone', 'Email', 'Class', 'Course', 'Course starts', 'Sessions', 'Month', 'Amount', 'Paid', 'Still due', 'Status', 'Renewal', 'Method', 'Due date', 'Paid on', 'Code', 'Note'].map((key) => t(key));
    const lines = invoices.map((invoice) => {
        const state = rowState(invoice, today);
        const renewal = RENEWAL[invoice.renewal ?? 'none'];
        return [
            invoice.student_name,
            invoice.student?.contact_number,
            invoice.student?.email,
            invoice.class_name,
            invoice.lesson_title,
            invoice.course?.starts_on ?? '',
            invoice.sessions ?? '',
            invoice.month.slice(0, 7),
            invoice.amount,
            invoice.paid_amount,
            invoice.status === 'unpaid' ? amountDue(invoice) : 0,
            t(STATES[state].label) + (invoice.void_reason && state !== 'switched' ? ` (${t(VOID_REASONS[invoice.void_reason])})` : ''),
            t(renewal.label),
            invoice.method ? t(METHOD_LABELS[invoice.method]) : '',
            invoice.due_date,
            invoice.paid_at ? invoice.paid_at.slice(0, 10) : '',
            invoice.payment_code,
            invoice.note,
        ];
    });
    const csv = [head, ...lines].map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `tuition-${name}.csv` });
    link.click();
    URL.revokeObjectURL(url);
}

// A random key for the bank webhook (shown once, pasted into SePay and the function secret).
export function randomKey(length = 40) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, (byte) => chars[byte % chars.length]).join('');
}

// Bank transfer notes come from the server in English: the fixed ones are i18n keys, the ones
// with a code or an amount are rebuilt from their parts; anything else (a note staff typed) is data.
const TRANSFER_NOTES = [
    [/^Unknown invoice code (\w+)\.$/, (t, [code]) => t('Unknown invoice code {code}.', { code })],
    [/^Invoice (\w+) is already (\w+)\.$/, (t, [code, status]) => t('Invoice {code} is already {status}.', { code, status: t(status) })],
    [/^Partial payment: (\d+) still due\.$/, (t, [amount], vnd) => t('Partial payment: {amount} still due.', { amount: vnd(amount) })],
    [/^Paid (\d+) more than was due\.$/, (t, [amount], vnd) => t('Paid {amount} more than was due.', { amount: vnd(amount) })],
    [/^Booking #(\d+) is (\w+)\.$/, (t, [id, status]) => t('Booking #{id} is {status}.', { id, status: t(status) })],
];
const FIXED_NOTES = ['No invoice code in the transfer content.', 'Payment undone by staff.', 'Assigned by staff.', 'Room deposit, not tuition.', 'Taken back by staff.'];

export function transferNote(note, t, vnd) {
    if (!note) return '';
    if (FIXED_NOTES.includes(note)) return t(note);
    for (const [pattern, build] of TRANSFER_NOTES) {
        const match = note.match(pattern);
        if (match) return build(t, match.slice(1), vnd);
    }
    return note;
}

export const PROVIDERS = { sepay: 'SePay', demo: 'Demo' };

// The due date most of a course's invoices share (late ones get a later one), or null.
export function typicalDueDate(invoices) {
    const counts = new Map();
    for (const invoice of invoices) counts.set(invoice.due_date, (counts.get(invoice.due_date) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

// ---- The page's lists --------------------------------------------------------------------------

export const DUE_SOON_DAYS = 7;

// 'yyyy-MM-dd' + days.
export const shiftIso = (isoDate, days) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const byDueThenName = (a, b) => a.due_date.localeCompare(b.due_date) || a.class_name.localeCompare(b.class_name, 'vi') || a.student_name.localeCompare(b.student_name, 'vi');

// The courses running now, and finished ones still owed (rows from withCourses).
export const runningInvoices = (rows) => rows.filter((invoice) => invoice.course.phase === 'current' || (invoice.course.phase === 'done' && invoice.status === 'unpaid'));

// What to collect, across every class (unpaid invoices of any course):
//   late  past the due date, longest late first
//   soon  due today or within DUE_SOON_DAYS days, soonest first
export function todoLists(rows, today) {
    const unpaid = rows.filter((invoice) => invoice.status === 'unpaid');
    const until = shiftIso(today, DUE_SOON_DAYS);
    return {
        late: unpaid.filter((invoice) => invoice.due_date < today).sort(byDueThenName),
        soon: unpaid.filter((invoice) => invoice.due_date >= today && invoice.due_date <= until).sort(byDueThenName),
    };
}

// People (not invoices) on a list: one student late for two classes counts once.
export const peopleOn = (invoices) => new Set(invoices.map((invoice) => invoice.student_id ?? invoice.student_name)).size;

// One entry per class that hasn't ended, with its running course and the next one:
//   running   { count (invoices that count), settled (paid or waived), owed (₫), late } — null without a running course
//   renewal   'open' (the next course is billed: answers so far) | 'waiting' (planned, not billed yet)
//             | 'unplanned' (nothing after the running course) | 'none' (no course running or planned)
//   answers   renewalSummary() of the next course · due: when its answers are due
//   opensIn   sessions until the renewal opens (≤ 0: with tonight's check) — null without a running course
//   upcoming  the class itself starts later (cls.starts_on)
// `openAt` is tuition_settings.renewal_open_sessions. Sorted by name; with `openFirst`, classes whose
// renewal still has students who haven't answered come first.
export function classBoard(classes, progress, rows, today, openAt, { openFirst = false } = {}) {
    const byClass = routinesByClass(progress);
    const entries = classes.map((cls) => {
        const { current, next } = routineState(byClass.get(cls.id) ?? []);
        let running = null;
        if (current) {
            const live = rows.filter((invoice) => invoice.lesson_id === current.lesson_id && invoice.status !== 'void');
            const unpaid = live.filter((invoice) => invoice.status === 'unpaid');
            running = {
                count: live.length,
                settled: live.length - unpaid.length,
                owed: unpaid.reduce((sum, invoice) => sum + amountDue(invoice), 0),
                late: unpaid.filter((invoice) => invoice.due_date < today).length,
            };
        }
        const billed = next ? rows.filter((invoice) => invoice.lesson_id === next.lesson_id) : [];
        const renewal = next ? (billed.length ? 'open' : 'waiting') : current ? 'unplanned' : 'none';
        const left = current ? Math.max(0, current.session_count - current.sessions_held) : null;
        return {
            cls,
            current,
            next,
            running,
            renewal,
            answers: renewalSummary(billed),
            due: typicalDueDate(billed.filter((invoice) => invoice.status === 'unpaid')),
            left,
            opensIn: left === null ? null : left - openAt,
            upcoming: Boolean(cls.starts_on && cls.starts_on > today),
        };
    });
    const waiting = (entry) => (entry.renewal === 'open' && entry.answers.none.length > 0 ? 0 : 1);
    return entries.sort((a, b) => (openFirst ? waiting(a) - waiting(b) : 0) || a.cls.name.localeCompare(b.cls.name, 'vi'));
}

// What a search looks up beyond the lists on the page: a payment code ('OOPS7K3M9Q', invoices and
// room bookings share them) or a booking number ('#236'). Null for anything else (a name).
export function lookupOf(query) {
    const text = String(query ?? '').trim();
    const number = text.match(/^#(\d{1,9})$/);
    if (number) return { kind: 'booking', term: number[1] };
    const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^OOPS[2-9A-HJ-NP-Z]{6}$/);
    return code ? { kind: 'code', term: code[0] } : null;
}
