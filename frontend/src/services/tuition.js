import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';

// Tuition (học phí) is charged per COURSE (khoá): one routine of N sessions (class_lessons) — see
// supabase/migrations/20261116000100_course_tuition.sql and api-contract §3 "Tuition".
// One invoice per student and course (`lesson_id`); `month` = the month the course starts ('yyyy-MM-01').
//
// Invoice { id, student_id, class_id, lesson_id, lesson_title (the course), sessions (how many it covers:
//   fewer when someone joined late and pays only for the sessions left), student_name, class_name, month, amount, paid_amount,
//   status: 'unpaid' | 'paid' | 'waived' | 'void',
//   renewal: 'continue' | 'stop' | null (the student's answer for that month; null = no answer yet),
//   method: 'transfer' | 'cash' | null, payment_code ('OOPS' + 6, goes in the transfer content),
//   due_date, paid_at, void_reason: 'stopped' | 'not_renewed' | 'removed' | 'switched' | null,
//   switched_from (the old class's invoice when the student switched class), note, created_at, updated_at }
//
// Renewal (tuition_settings): when the running course has `renewal_open_sessions` (2) or fewer sessions left
// and the next course is planned, every member is billed for it; pay or answer by its `due_session`-th (2nd)
// session. Joining late pays for the sessions left (`prorate_late_join`). A daily job cancels unpaid,
// unanswered invoices after their due date and takes those students out of the class when that course runs;
// answering "continue" keeps them in (then just overdue). Course progress: listLessonProgress (classes.js).

export const INVOICE = `id, student_id, class_id, lesson_id, lesson_title, sessions, student_name, class_name, month, amount,
    paid_amount, status, renewal, method, payment_code, due_date, paid_at, void_reason, switched_from, note, created_at, updated_at`;
// The course (routine) of an invoice, with its promo clip (services/promos.js) for the renewal question.
const COURSE = 'course:class_lessons!lesson_id(id, class_id, title, starts_on, session_count, price, video_url, promo_path, promo_poster_path, promo_url, promo_caption, promo_seconds)';
const PERSON = 'id, username, full_name, email, contact_number, avatar_path, updated_at';
const CLASS = 'id, name, image_path, price, instructor_id';

// ---- Helpers ---------------------------------------------------------------------------

export const amountDue = (invoice) => Math.max(0, Number(invoice.amount) - Number(invoice.paid_amount));

// 'paid' | 'waived' | 'void' | 'overdue' | 'partial' | 'due' (unpaid, not late yet). `today` is 'yyyy-MM-dd'.
export function invoiceState(invoice, today) {
    if (invoice.status !== 'unpaid') return invoice.status;
    if (today && invoice.due_date < today) return 'overdue';
    return Number(invoice.paid_amount) > 0 ? 'partial' : 'due';
}

// VietQR image for paying an invoice by bank transfer (any Vietnamese banking app scans it):
// the studio's account, the amount still due and the invoice code as the transfer content.
// Null until an admin has entered the bank account.
export function vietQrUrl(settings, invoice) {
    if (!settings?.bank_code || !settings?.account_no) return null;
    const params = new URLSearchParams({ amount: String(amountDue(invoice)), addInfo: invoice.payment_code });
    if (settings.account_name) params.set('accountName', settings.account_name);
    return `https://img.vietqr.io/image/${encodeURIComponent(settings.bank_code)}-${encodeURIComponent(settings.account_no)}-compact2.png?${params}`;
}

// ---- Settings ---------------------------------------------------------------------------

// { bank_code, bank_name, account_no, account_name, renewal_open_sessions, due_session, prorate_late_join,
//   invoice_day, due_day (monthly leftovers, unused) } (any signed-in user)
export async function getTuitionSettings() {
    return unwrap(
        await supabase
            .from('tuition_settings')
            .select('bank_code, bank_name, account_no, account_name, renewal_open_sessions, due_session, prorate_late_join, invoice_day, due_day, updated_at')
            .eq('id', 1)
            .single()
    );
}

// Admin only. Empty strings clear a field.
export async function updateTuitionSettings(fields) {
    const patch = {};
    for (const key of ['bank_code', 'bank_name', 'account_no', 'account_name']) {
        if (key in fields) patch[key] = String(fields[key] ?? '').trim() || null;
    }
    for (const key of ['invoice_day', 'due_day', 'renewal_open_sessions', 'due_session']) if (key in fields) patch[key] = Number(fields[key]);
    if ('prorate_late_join' in fields) patch.prorate_late_join = Boolean(fields.prorate_late_join);
    return unwrap(await supabase.from('tuition_settings').update(patch).eq('id', 1).select().single());
}

// True on the hosted demo and the local stack: the QR dialog may simulate the bank transfer.
export async function isPaymentSandbox() {
    return Boolean(unwrap(await supabase.rpc('tuition_sandbox')));
}

// ---- Students ---------------------------------------------------------------------------

// The signed-in student's invoices (RLS), newest month first, with their class.
export async function listMyInvoices() {
    return unwrap(
        await supabase
            .from('tuition_invoices')
            .select(`${INVOICE}, class:classes!class_id(${CLASS}), ${COURSE}`)
            .order('month', { ascending: false })
            .order('class_name')
    );
}

export async function getInvoice(id) {
    return unwrap(await supabase.from('tuition_invoices').select(INVOICE).eq('id', id).single());
}

// 'continue' | 'stop' for that month (the student themself, or staff). Stopping the running
// month leaves the class now; stopping next month leaves when it starts.
export async function setRenewal(id, decision) {
    return unwrap(await supabase.rpc('tuition_set_renewal', { p_invoice: id, p_decision: decision }));
}

// Sandbox only: behaves as if the student's bank had sent the transfer.
export async function simulateTransfer(id) {
    return unwrap(await supabase.rpc('tuition_simulate_transfer', { p_invoice: id }));
}

// ---- Staff ------------------------------------------------------------------------------

// Every invoice of courses starting in a month, with the student's profile (null when the account was deleted).
export async function listInvoices(month) {
    return unwrap(
        await supabase
            .from('tuition_invoices')
            .select(`${INVOICE}, student:profiles!student_id(${PERSON}), class:classes!class_id(${CLASS}), ${COURSE}`)
            .eq('month', month)
            .order('class_name')
            .order('student_name')
    );
}

// Unpaid invoices whose due date has passed, oldest first (any month).
export async function listOverdueInvoices(today) {
    return unwrap(
        await supabase
            .from('tuition_invoices')
            .select(`${INVOICE}, student:profiles!student_id(${PERSON})`)
            .eq('status', 'unpaid')
            .lt('due_date', today)
            .order('due_date')
    );
}

// One student's invoices (staff), newest first.
export async function listStudentInvoices(studentId) {
    return unwrap(
        await supabase.from('tuition_invoices').select(INVOICE).eq('student_id', studentId).order('month', { ascending: false })
    );
}

// Cash at the desk (or a transfer seen in the bank app). `amount` defaults to what is still due.
export async function markPaid(id, { method = 'cash', amount = null, note = null } = {}) {
    return unwrap(await supabase.rpc('tuition_mark_paid', { p_invoice: id, p_method: method, p_amount: amount, p_note: note }));
}

// Undo a payment recorded by mistake; transfers that paid it go back to the inbox.
export async function undoPayment(id) {
    return unwrap(await supabase.rpc('tuition_undo_payment', { p_invoice: id }));
}

export async function waiveInvoice(id, note = null) {
    return unwrap(await supabase.rpc('tuition_waive', { p_invoice: id, p_note: note }));
}

// Waived → unpaid; cancelled (stopped / not renewed) → unpaid and back in the class.
export async function reopenInvoice(id) {
    return unwrap(await supabase.rpc('tuition_reopen', { p_invoice: id }));
}

// A note on its own ("Promised to pay cash at the weekend"); '' clears it. Any invoice (staff).
export async function setInvoiceNote(id, note) {
    return unwrap(await supabase.rpc('tuition_set_note', { p_invoice: id, p_note: note ?? '' }));
}

// A discount or a pro-rated first month (unpaid invoices only).
export async function setInvoiceAmount(id, amount, note = null) {
    return unwrap(await supabase.rpc('tuition_set_amount', { p_invoice: id, p_amount: amount, p_note: note }));
}

// Every invoice of one class (optionally one course), newest course first — for the class page.
export async function listClassInvoices(classId, { lessonId = null } = {}) {
    let query = supabase
        .from('tuition_invoices')
        .select(`${INVOICE}, student:profiles!student_id(${PERSON}), ${COURSE}`)
        .eq('class_id', classId)
        .order('month', { ascending: false })
        .order('student_name');
    if (lessonId) query = query.eq('lesson_id', lessonId);
    return unwrap(await query);
}

// Open a course's renewal now: every member of its class is billed for it. Returns how many invoices.
export async function openCourse(lessonId) {
    return unwrap(await supabase.rpc('tuition_open_course', { p_lesson: lessonId }));
}

// Older screens: opens every course starting in `month`. Returns how many.
export async function openMonth(month) {
    return unwrap(await supabase.rpc('tuition_open_month', { p_month: month }));
}

// The daily job, on demand: { billed, opened, not_renewed, enrolments_ended }.
export async function runCycle() {
    return unwrap(await supabase.rpc('tuition_run_cycle'));
}

// Move a student to another class — between courses, never mid-course (no refunds): they join the new
// class's upcoming course (starting today or later; billed in full; joined_at = its start) and finish the
// course they paid for in the old class, leaving after its last session (class_students.leaves_after).
// Their invoice for the old class's next course, if already opened, becomes void 'switched' and money paid on
// it moves to the new course (`switched_from` points at it). If the old class has nothing running they leave
// now (and join the new class's running course, pro-rated, when it has no upcoming one). INVALID_STATE when
// the new class has no upcoming course ("plan its next course first"). Returns the new course's invoice.
export async function switchClass(studentId, fromClassId, toClassId, note = null) {
    return unwrap(await supabase.rpc('tuition_switch_class', { p_student: studentId, p_from: fromClassId, p_to: toClassId, p_note: note }));
}

// ---- Bank transfers (staff inbox) -----------------------------------------------------------

// { id, provider, provider_ref, amount, content, received_at, status: 'matched' | 'unmatched' | 'ignored',
//   invoice_id, note, invoice: { id, student_name, class_name, month, payment_code } | null,
//   booking_id, booking: { id, date, start_time, end_time, payment_code, room, guest } | null } — a transfer
//   pays an invoice or a room booking (services/bookingPayments.js).
export async function listTransfers({ status = null, limit = 100 } = {}) {
    let query = supabase
        .from('bank_transfers')
        .select('id, provider, provider_ref, amount, content, received_at, status, invoice_id, booking_id, note, invoice:tuition_invoices!invoice_id(id, student_id, student_name, class_name, month, payment_code), booking:bookings!booking_id(id, date, start_time, end_time, payment_code, room:rooms!room_id(id, name), guest:profiles!guest_id(id, full_name, username))')
        .order('received_at', { ascending: false })
        .limit(limit);
    if (status) query = query.eq('status', status);
    return unwrap(await query);
}

export async function assignTransfer(transferId, invoiceId) {
    return unwrap(await supabase.rpc('tuition_assign_transfer', { p_transfer: transferId, p_invoice: invoiceId }));
}

// Extra money: a paid invoice holding more than its price (a transfer bigger than the course, one put on
// the wrong course, a class switch). Staff move it onto another unpaid invoice or record that it went back
// to the student (tuition_extra_moves; api-contract §5).
export const extraOf = (invoice) => (invoice?.status === 'paid' ? Math.max(0, Number(invoice.paid_amount) - Number(invoice.amount)) : 0);

// Invoices holding extra money, newest payment first.
export async function listExtraInvoices() {
    return unwrap(await supabase.rpc('tuition_extra_list'));
}

// Move `amount` (default: as much as fits) of an invoice's extra onto another unpaid invoice → that invoice.
export async function moveExtra(invoiceId, toInvoiceId, amount = null) {
    return unwrap(await supabase.rpc('tuition_move_extra', { p_invoice: invoiceId, p_to_invoice: toInvoiceId, p_amount: amount }));
}

// Record that `amount` (default: all) of the extra went back to the student, in cash or by transfer.
export async function refundExtra(invoiceId, { amount = null, method = 'cash', note = null } = {}) {
    return unwrap(await supabase.rpc('tuition_refund_extra', { p_invoice: invoiceId, p_amount: amount, p_method: method, p_note: note }));
}

// Not tuition (a room deposit, a refund…), or back to the inbox with ignore = false.
export async function ignoreTransfer(transferId, ignore = true, note = null) {
    return unwrap(await supabase.rpc('tuition_ignore_transfer', { p_transfer: transferId, p_ignore: ignore, p_note: note }));
}
