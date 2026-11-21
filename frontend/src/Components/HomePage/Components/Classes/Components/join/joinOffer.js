// What joining a class means for a student, worked out the way the database bills it
// (private.on_enrolment_added → private.bill_class / private.bill_course, 20261116000100_course_tuition.sql):
//   - a course costs its own price, else the class price;
//   - someone new who joins after sessions were held pays for the sessions left (when the studio prorates late
//     joins: tuition_settings.prorate_late_join), rounded to 1,000 ₫, counted on the day they're added;
//   - joining from the next course pays that course in full;
//   - near the end of the running course (renewal_open_sessions left or fewer) the next course's sign-up is open,
//     so joining now bills it too, with the usual "carry on?" question.
// A student who already has an invoice in the class may get an old one back instead, so no fee is predicted then.

// The start choices a request carries (class_join_requests.start_pref), as English keys.
export const START_LABELS = { now: 'Start now', next: 'From the next course' };

// The running course and the next planned one, as lesson_progress reports them (like the class hub's routineNow).
export function coursesOf(progress = []) {
    const current = progress.filter((row) => row.status === 'current').sort((a, b) => b.starts_on.localeCompare(a.starts_on))[0] ?? null;
    const planned = progress.filter((row) => row.status === 'planned').sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null;
    return { current, planned };
}

// loadJoinOffer() data and the class price →
//   { now: { course, left, sessions (billed), amount, prorated } | null,
//     next: { course, amount } | null,
//     choice (both exist: the student picks), feeKnown, prorates (sessions left are counted on the day they're added),
//     nextBilledToo (joining now also bills the next course) }
export function joinOffer(offer, classPrice) {
    const { current, planned } = coursesOf(offer.progress ?? []);
    const settings = offer.settings;
    const priceOf = (row) => Number(offer.prices.get(row.lesson_id) ?? classPrice);
    const prorates = Boolean(settings?.prorate_late_join);

    let now = null;
    if (current) {
        const left = Math.max(current.session_count - current.sessions_held, 0);
        const prorated = prorates && current.sessions_held > 0 && left < current.session_count;
        const price = priceOf(current);
        now = {
            course: current,
            left,
            sessions: prorated ? left : current.session_count,
            amount: prorated ? Math.round((price * left) / current.session_count / 1000) * 1000 : price,
            prorated,
        };
    }
    const next = planned ? { course: planned, amount: priceOf(planned) } : null;

    return {
        now,
        next,
        choice: Boolean(now && next),
        feeKnown: Boolean(settings) && !offer.history && offer.progress !== null,
        prorates: prorates && Boolean(now),
        nextBilledToo: Boolean(now && next && settings && now.left <= settings.renewal_open_sessions),
    };
}
