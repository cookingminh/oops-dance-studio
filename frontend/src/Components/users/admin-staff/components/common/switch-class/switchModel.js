import { formatTime } from '@/lib/format';

// Pure helpers for the "Switch class" dialog: what each class card says and what the switch does,
// mirroring public.tuition_switch_class (supabase/migrations/20261116000400_switch_after_course.sql),
// so the preview is what happens. The studio doesn't switch in the middle of a course and doesn't
// refund a started course:
//   * old class: they finish the course running there (paid or still owed, it stays) and leave after
//     its last session; with nothing running there they leave today.
//   * new class: they join from its first course starting today or later, billed in full; only when
//     the old class has nothing running do they join its running course instead (pro-rated late join).
//     No such course: refused ("plan its next course first").
//   * the old class's later courses (already billed) are cancelled; what was paid on them moves.
// `today` is the studio's 'yyyy-MM-dd'; `progress` a Map(lesson id → listLessonProgress row).
// Texts are English i18n keys.

export const displayName = (profile) => profile?.full_name?.trim() || profile?.username || '';

// "Mon, Thu · 18:00–19:30" when every session starts at the same time, otherwise
// "Mon 18:00 · Thu 19:30". '' without a schedule.
export function weeklyTimes(schedules = [], dayName) {
    if (!schedules.length) return '';
    const sorted = [...schedules].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
    const slots = new Set(sorted.map((s) => `${s.start_time}-${s.end_time}`));
    if (slots.size === 1) {
        const days = [...new Set(sorted.map((s) => dayName(s.day_of_week, 'short')))].join(', ');
        return `${days} · ${formatTime(sorted[0].start_time)}–${formatTime(sorted[0].end_time)}`;
    }
    return sorted.map((s) => `${dayName(s.day_of_week, 'short')} ${formatTime(s.start_time)}`).join(' · ');
}

// The course a class is running today (the latest one started and not finished), or null.
export function runningCourse(cls, progress) {
    return (cls?.lessons ?? [])
        .map((lesson) => ({ lesson, row: progress.get(lesson.id) }))
        .filter(({ row }) => row?.status === 'current')
        .sort((a, b) => b.lesson.starts_on.localeCompare(a.lesson.starts_on))
        .map(({ lesson, row }) => ({ ...lesson, held: row.sessions_held, ends_on: row.ends_on }))[0] ?? null;
}

// The course a student joins in `toClass` (see the header): { course, late } or null when there is none.
export function targetCourse(toClass, { progress, today, fromRunning }) {
    const upcoming = (toClass.lessons ?? [])
        .filter((lesson) => lesson.starts_on >= today && !(toClass.ended_on && lesson.starts_on > toClass.ended_on))
        .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0];
    if (upcoming) return { course: { ...upcoming, held: 0 }, late: false };
    if (fromRunning) return null;
    const running = runningCourse(toClass, progress);
    return running ? { course: running, late: true } : null;
}

// Round to the nearest 1.000 ₫, like the server's pro-rating.
const thousand = (amount) => Math.round(amount / 1000) * 1000;

// What switching does, for the preview:
//   blocked      true when the new class has no course to join (plan one first)
//   keep         the old class's running course they finish: { title, ends_on, invoice (theirs or null) }, or null
//   leaveOn      their last day in the old class ('yyyy-MM-dd'; today when nothing runs there)
//   target       the course they join: { title, starts_on, session_count, held }, `late` when it is running
//   joinOn       the day they join the new class
//   fee          what the new course costs them (pro-rated for a late join): { amount, full, left }
//   moved        old class's later courses that get cancelled: [{ id, title, paid }], and `movedTotal`
//   due          left to pay on the new course after the money that moves; `extra` the surplus
//   earlierUnpaid  unpaid invoices of finished courses in the old class (they stay there)
export function switchPreview({ invoices, fromClass, toClass, today, settings, progress }) {
    const keepCourse = runningCourse(fromClass, progress);
    const leaveOn = keepCourse ? keepCourse.ends_on ?? today : today;
    const target = targetCourse(toClass, { progress, today, fromRunning: Boolean(keepCourse) });
    const mine = invoices.filter((invoice) => invoice.class_id === fromClass.id);
    const keep = keepCourse ? { ...keepCourse, invoice: mine.find((invoice) => invoice.lesson_id === keepCourse.id) ?? null } : null;
    const startOf = (invoice) => (fromClass.lessons ?? []).find((lesson) => lesson.id === invoice.lesson_id)?.starts_on;
    const moved = mine
        .filter((invoice) => invoice.status !== 'void' && invoice.lesson_id != null && (startOf(invoice) ?? '') > leaveOn)
        .map((invoice) => ({ id: invoice.id, title: invoice.lesson_title, paid: Number(invoice.paid_amount) }));
    const movedTotal = moved.reduce((sum, row) => sum + row.paid, 0);
    const keepIds = new Set([keep?.invoice?.id, ...moved.map((row) => row.id)]);
    const earlierUnpaid = mine.filter((invoice) => invoice.status === 'unpaid' && !keepIds.has(invoice.id));

    if (!target) return { blocked: true, keep, leaveOn, moved, movedTotal, earlierUnpaid };

    const full = Number(target.course.price ?? toClass.price);
    const count = Number(target.course.session_count);
    const held = target.late ? Number(target.course.held ?? 0) : 0;
    const prorate = target.late && held > 0 && (settings?.prorate_late_join ?? true) && held < count;
    const amount = prorate ? thousand((full * (count - held)) / count) : full;
    return {
        blocked: false,
        keep,
        leaveOn,
        target: { ...target.course, late: target.late },
        joinOn: target.course.starts_on > today ? target.course.starts_on : today,
        fee: { amount, full, left: count - held, prorated: prorate },
        moved,
        movedTotal,
        due: Math.max(0, amount - movedTotal),
        extra: Math.max(0, movedTotal - amount),
        earlierUnpaid,
    };
}

// The chip under the new course in the preview: { key, tone, amount? } (key uses {amount}).
export function resultOf(preview) {
    if (preview.extra > 0) return { key: '{amount} extra', tone: 'extra', amount: preview.extra };
    if (preview.due === 0) return { key: 'Paid in full', tone: 'good' };
    return { key: '{amount} to pay', tone: 'due', amount: preview.due };
}

// Price difference of a class against the current one: "+400.000 ₫" / "−100.000 ₫" / null.
export function priceDelta(toPrice, fromPrice, vnd) {
    const diff = Number(toPrice) - Number(fromPrice);
    if (!Number.isFinite(diff) || diff === 0) return null;
    return { text: `${diff > 0 ? '+' : '−'}${vnd(Math.abs(diff))}`, up: diff > 0 };
}
