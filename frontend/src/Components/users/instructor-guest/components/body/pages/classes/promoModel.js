import { renewalFacts } from '../../../../../admin-staff/components/body/class-hub/page/tuition/courseModel';

const RENEWAL_OPENS_AT = 2; // tuition_settings.renewal_open_sessions when it couldn't be read

// When a class's next routine needs its promo: before that course's renewal opens (students are asked
// then whether they continue). { soon: false, date: 'yyyy-MM-dd' }, or { soon: true, date: null } when
// students are deciding already. `state` is routineState(cls.routines) with a `next` routine.
export function promoDeadline(cls, state) {
    const facts = renewalFacts(cls, state.current, state.next, [], cls.renewalOpensAt ?? RENEWAL_OPENS_AT);
    return facts.opensOn ? { soon: false, date: facts.opensOn } : { soon: true, date: null };
}
