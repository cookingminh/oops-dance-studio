// Reading a class switch back from the invoices (staff and student tuition pages).
// public.tuition_switch_class (supabase/migrations/20261116000400_switch_after_course.sql) writes English notes:
//   old class's next course (void, 'switched')   "Moved to {class}."
//   new class's course (switched_from set)        "Switched from {class}." + " Paid {N} more than this course costs."
//                                                 (money moved from a paid next course was more than the new
//                                                 course) + " {the staff's note}"
// switched_from points at the old class's cancelled next-course invoice, or (when there was none) at
// their invoice for the old course they finish. Older switches moved part of a running course:
//   "Moved to {class} after {N} sessions; {K} kept for them." (K stayed paid on the old invoice).
// The class names come from the linked invoice when it is loaded, otherwise from the note.

const MOVED = /^Moved to (.+?)(?: after (\d+) sessions; (\d+) kept for them)?\.$/s;
const FROM = /^Switched from (.+?)\.(?: Paid (\d+) more than this (?:course|class) costs\.)?(?: (.+))?$/s;

export const isSwitchedAway = (invoice) => invoice.status === 'void' && invoice.void_reason === 'switched';
export const isSwitchedIn = (invoice) => invoice.switched_from != null;

// The invoice of the new class that came out of switching away from `invoice` (or null).
export const switchedInto = (invoice, invoices = []) => invoices.find((other) => other.switched_from === invoice.id) ?? null;

// Where the student went: "K-pop Cover Nâng Cao" (or '' when unknown).
export function movedToName(invoice, invoices = []) {
    return switchedInto(invoice, invoices)?.class_name ?? invoice.note?.match(MOVED)?.[1] ?? '';
}

// An older switch in the middle of a course: { held, kept } — the sessions danced before it and the
// money that stayed paid for them on this invoice. Null otherwise.
export function keptForDanced(invoice) {
    const match = isSwitchedAway(invoice) ? invoice.note?.match(MOVED) : null;
    return match?.[2] ? { held: Number(match[2]), kept: Number(match[3]) } : null;
}

// The new class's invoice: where they came from, the surplus noted by the server and whatever note
// staff added. Null for an invoice that isn't the result of a switch.
export function switchedFrom(invoice, invoices = []) {
    if (!isSwitchedIn(invoice)) return null;
    const old = invoices.find((other) => other.id === invoice.switched_from);
    const parsed = invoice.note?.match(FROM);
    return {
        className: old?.class_name ?? parsed?.[1] ?? '',
        extra: parsed?.[2] ? Number(parsed[2]) : 0,
        // Staff's own words (data, not translated); the whole note when it was edited since.
        note: parsed ? parsed[3] ?? '' : invoice.note ?? '',
    };
}
