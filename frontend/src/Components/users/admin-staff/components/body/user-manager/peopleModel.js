import { LuAlertTriangle, LuBriefcase, LuGraduationCap, LuMusic2, LuShieldCheck, LuSparkles, LuUser } from 'react-icons/lu';
import { formatTime } from '@/lib/format';
import { EASE_OUT } from '../../common/motion';

// The People page shows five kinds of people. In the database a Student is a `guest` who is
// enrolled in at least one class (same rule as useRoleLabel).
// Labels and texts are English i18n keys.
export const KINDS = {
    student: { role: 'guest', label: 'Student', plural: 'Students', icon: LuGraduationCap, tone: 'violet' },
    guest: { role: 'guest', label: 'Guest', plural: 'Guests', icon: LuUser, tone: 'slate' },
    instructor: { role: 'instructor', label: 'Instructor', plural: 'Instructors', icon: LuMusic2, tone: 'blue' },
    staff: { role: 'staff', label: 'Staff', plural: 'Staff', icon: LuBriefcase, tone: 'emerald' },
    admin: { role: 'admin', label: 'Admin', plural: 'Admins', icon: LuShieldCheck, tone: 'rose' },
};
export const KIND_ORDER = ['student', 'guest', 'instructor', 'staff', 'admin'];

// Filters beyond the roles (overview strip).
export const INSIGHTS = {
    new: { label: 'New this month', icon: LuSparkles, tone: 'pink' },
    attention: { label: 'Missing details', icon: LuAlertTriangle, tone: 'amber' },
};

// What each database role can open, for the role pickers (Add person, Change role).
export const ROLE_INFO = {
    guest: {
        kind: 'student',
        title: 'Student or guest',
        summary: 'Books rooms and joins classes. Shown as a Student once enrolled in a class.',
        opens: 'Their own space: bookings, classes and attendance.',
    },
    instructor: {
        kind: 'instructor',
        title: 'Instructor',
        summary: 'Teaches classes and checks in to each session with a photo.',
        opens: 'Their teaching space: today’s sessions, their classes and students.',
    },
    staff: {
        kind: 'staff',
        title: 'Staff',
        summary: 'Runs the studio day to day.',
        opens: 'The workspace: bookings, rooms, classes, students and attendance. Not Users or Payroll.',
    },
    admin: {
        kind: 'admin',
        title: 'Admin',
        summary: 'Runs the whole studio, including accounts and pay.',
        opens: 'Everything staff can open, plus Users and Payroll.',
    },
};
export const ROLE_CHOICES = ['guest', 'instructor', 'staff', 'admin'];

const STUDIO_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const studioDay = new Intl.DateTimeFormat('en-CA', { timeZone: STUDIO_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

// timestamptz → the studio's calendar date 'yyyy-MM-dd'.
export const studioDateOf = (timestamp) => (timestamp ? studioDay.format(new Date(timestamp)) : '');

// Lower case, no Vietnamese accents ("Thảo Vy" → "thao vy"), so searches work without diacritics.
export function fold(text) {
    return String(text ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();
}

const digitsOf = (text) => String(text ?? '').replace(/\D/g, '');

export const displayName = (profile) => profile?.full_name?.trim() || profile?.username || profile?.email || '';

// "Mon, Wed · 18:00" — the days a class meets and its first start time.
export function scheduleSummary(schedules = [], dayName) {
    if (!schedules.length) return '';
    const sorted = [...schedules].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
    const days = [...new Set(sorted.map((s) => s.day_of_week))].map((day) => dayName(day, 'short'));
    return `${days.join(', ')} · ${formatTime(sorted[0].start_time)}`;
}

// Profiles + enrolments + classes → one entry per person with everything the page shows.
// `month` is the studio's current month ('yyyy-MM-01') for "new this month".
export function buildPeople(directory, month) {
    if (!directory) return [];
    const classById = new Map(directory.classes.map((cls) => [cls.id, cls]));
    const enrolmentsOf = new Map();
    for (const row of directory.enrolments) {
        const cls = classById.get(row.class_id);
        if (!cls) continue;
        if (!enrolmentsOf.has(row.student_id)) enrolmentsOf.set(row.student_id, []);
        enrolmentsOf.get(row.student_id).push({ class: cls, joined_at: row.joined_at, leaves_after: row.leaves_after ?? null });
    }
    const taughtBy = new Map();
    for (const cls of directory.classes) {
        if (!taughtBy.has(cls.instructor_id)) taughtBy.set(cls.instructor_id, []);
        taughtBy.get(cls.instructor_id).push(cls);
    }

    return directory.profiles.map((profile) => {
        const enrolments = enrolmentsOf.get(profile.id) ?? [];
        const teaches = taughtBy.get(profile.id) ?? [];
        const kind = profile.role === 'guest' ? (enrolments.length ? 'student' : 'guest') : profile.role;
        const joined = studioDateOf(profile.created_at);
        const missing = [];
        if (!profile.full_name?.trim()) missing.push('name');
        if (!profile.contact_number?.trim()) missing.push('phone');
        const classNames = [...enrolments.map((e) => e.class.name), ...teaches.map((cls) => cls.name)];
        return {
            ...profile,
            kind,
            name: displayName(profile),
            enrolments,
            teaches,
            joined,
            isNew: Boolean(month) && joined >= month,
            missing,
            searchText: fold([profile.full_name, profile.username, profile.email, profile.contact_number, ...classNames].join(' ')),
            phoneDigits: digitsOf(profile.contact_number),
        };
    });
}

// Every word of the query must match the name, @username, email, phone or a class name.
export function matchesQuery(person, query) {
    const words = fold(query).replace(/@/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length === 0) return true;
    const digits = digitsOf(query);
    // "0903 111 001" or "0903.111.001": compare phone numbers by their digits.
    if (digits.length >= 3 && /^[\d\s.+()-]+$/.test(query.trim())) return person.phoneDigits.includes(digits);
    return words.every((word) => person.searchText.includes(word));
}

export function matchesView(person, view) {
    if (view === 'all') return true;
    if (view === 'new') return person.isNew;
    if (view === 'attention') return person.missing.length > 0;
    return person.kind === view;
}

const collator = new Intl.Collator('vi', { sensitivity: 'base' });
export const SORTERS = {
    newest: (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || collator.compare(a.name, b.name),
    name: (a, b) => collator.compare(a.name, b.name),
};

// The visible list as a CSV for a spreadsheet (UTF-8 with BOM so Excel shows Vietnamese correctly).
export function downloadPeopleCsv(people, t, today) {
    const head = [t('Name'), t('Username'), t('Email'), t('Phone'), t('Role'), t('Classes'), t('Date of birth'), t('Member since')];
    const lines = people.map((p) => [
        p.full_name,
        p.username,
        p.email,
        p.contact_number,
        t(KINDS[p.kind].label),
        [...p.enrolments.map((e) => e.class.name), ...p.teaches.map((cls) => cls.name)].join(', '),
        p.date_of_birth,
        p.joined,
    ]);
    const csv = [head, ...lines].map((line) => line.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `people-${today ?? 'export'}.csv` });
    link.click();
    URL.revokeObjectURL(url);
}

// A temporary password that is easy to read out or type: no 0/O, 1/l/I.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePassword() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const chars = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');
    return `Oops-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// Whole years between a 'yyyy-MM-dd' birthday and today.
export function ageOn(birthday, today) {
    if (!birthday || !today) return null;
    const [by, bm, bd] = birthday.split('-').map(Number);
    const [ty, tm, td] = today.split('-').map(Number);
    return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

// People listed at first; "Show more" adds the same again.
export const PAGE_SIZE = 24;

// List rows enter a little faster than whole cards.
export const rowIn = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};
export const rowStagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.025 } },
};

// The line under the role chip: a student's classes, what an instructor teaches, what staff do.
export function contextLineOf(person, t) {
    switch (person.kind) {
        case 'student':
            return person.enrolments.map((e) => e.class.name).join(' · ');
        case 'guest':
            return t('Not in a class yet');
        case 'instructor':
            return person.teaches.length
                ? t('Teaches {classes}', { classes: person.teaches.map((cls) => cls.name).join(', ') })
                : t('No class to teach yet');
        case 'staff':
            return t('Bookings, classes and attendance');
        default:
            return t('Full access, including Users and Payroll');
    }
}
