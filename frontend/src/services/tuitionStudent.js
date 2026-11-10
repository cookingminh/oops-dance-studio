import { supabase } from '@/lib/supabase';
import { unwrap } from './errors';
import { getStudioToday } from './studio';
import { listLessonProgress } from './classes';
import { getTuitionSettings, isPaymentSandbox, listMyInvoices } from './tuition';

// Everything the student's tuition views need in one call: the tuition page, the overview card
// and the line in each class view all read it, so it is kept for a short while (switching
// classes doesn't refetch) and dropped after anything changes an invoice.
//   { today: 'yyyy-MM-dd',
//     invoices    listMyInvoices(), one per course (with `course` embedded)
//     progress    listLessonProgress() of every class they have an invoice or a place in: sessions held,
//                 last session (ends_on) and status ('planned' | 'current' | 'done' | 'stopped') per course
//     enrolments  [{ class_id, joined_at, leaves_after }]: their places now (RLS: their own rows);
//                 joined_at ahead = joins from that course, leaves_after = leaves after that day (class switch)
//     settings, sandbox }

const FRESH_MS = 30_000;
let cache = null; // { userId, at, promise }

// The student's places (RLS: class_students_select lets a guest read their own rows).
async function listMyPlaces(userId) {
    return unwrap(await supabase.from('class_students').select('class_id, joined_at, leaves_after').eq('student_id', userId));
}

export function loadMyTuition(userId, { fresh = false } = {}) {
    if (!fresh && cache?.userId === userId && Date.now() - cache.at < FRESH_MS) return cache.promise;
    const promise = Promise.all([
        getStudioToday(),
        listMyInvoices(),
        listMyPlaces(userId).catch(() => []),
        // Settings and the sandbox flag only change what the pay dialog shows: never block on them.
        getTuitionSettings().catch(() => null),
        isPaymentSandbox().catch(() => false),
    ]).then(async ([today, invoices, enrolments, settings, sandbox]) => {
        const classIds = [...new Set([...invoices.map((row) => row.class_id), ...enrolments.map((row) => row.class_id)].filter((id) => id != null))];
        // Progress only adds "3 of 8 held · until …": the page still works without it.
        const progress = await listLessonProgress(classIds).catch(() => []);
        return { today, invoices, progress, enrolments, settings, sandbox };
    });
    cache = { userId, at: Date.now(), promise };
    promise.catch(() => {
        if (cache?.promise === promise) cache = null;
    });
    return promise;
}

// After a payment, a renewal answer or a simulated transfer.
export function forgetMyTuition() {
    cache = null;
}
