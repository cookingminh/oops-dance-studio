import { CHANGE_REASONS } from '@/services/sessionChanges';
import { isoWeekdayOf } from '@/lib/format';
import { makeUpProblem } from '../../body/class-manager/routines/routineData';

// Words for session changes (a session called off, moved, made up; the studio closed for a day), shared by
// the staff dialogs, the calendars and the students' / teachers' views and bell (services/sessionChanges.js).

// A reason picked from CHANGE_REASONS is stored as its English key and translated where it is shown; one
// staff typed is shown as written (data, not a key).
export const reasonText = (reason, t) => {
    if (!reason) return '';
    return CHANGE_REASONS.includes(reason) ? t(reason) : reason;
};

// What to store for the reason field: a ready-made reason (as shown in this language) goes back to its key,
// so everyone reads it in their own language.
export function reasonToSave(text, t) {
    const typed = String(text ?? '').trim();
    return CHANGE_REASONS.find((key) => t(key) === typed) ?? typed;
}

// A day the way the class reads it on a notice: "Wed 13 Nov" / "Thứ 4 13/11". `short` for badges and tight
// rows: "Wed 13/11" / "T4 13/11". (Vietnamese says the weekday by its number, which Intl doesn't.)
export function changeDay(date, { lang, formatDate }, { short = false } = {}) {
    if (!date) return '';
    const [, month, day] = date.split('-').map(Number);
    if (lang === 'vi') {
        const weekday = isoWeekdayOf(date);
        let name = `${short ? 'T' : 'Thứ '}${weekday + 1}`;
        if (weekday === 7) name = short ? 'CN' : 'Chủ nhật';
        return `${name} ${day}/${month}`;
    }
    return short ? `${formatDate(date, 'weekdayShort')} ${day}/${month}` : formatDate(date, 'short');
}

// A failed call-off / move as { key, vars } (English key), or null to show the error's own message. The
// make-up part has the same rules as "Add a make-up session" (room taken, class already meets that day…).
export function changeProblem(error) {
    const detail = error?.detail ?? '';
    if (error?.code === 'INVALID_STATE' && /already started/i.test(detail)) return { key: 'This session has already started, so it can’t be called off.' };
    if (error?.code === 'INVALID_STATE' && /doesn.t meet that day/i.test(detail)) return { key: 'The class doesn’t meet that day.' };
    if (error?.code === 'INVALID_INPUT' && /another day for the make-up/i.test(detail)) return { key: 'Pick another day for the make-up.' };
    if (error?.code === 'INVALID_INPUT' && /say why/i.test(detail)) return { key: 'Say why the session is called off.' };
    return makeUpProblem(error);
}

// The words for one change of my_session_changes ({ kind: 'cancelled' | 'make_up', class_name, date,
// start_time, end_time, reason, makes_up }), English keys translated with the page's i18n:
//   title   with the class: "K-pop Cover is off on Wed 13 Nov" / "K-pop Cover: make-up Sat 16 Nov, 10:00–11:30"
//   line    without it (inside the class's own view): "Off on Wed 13 Nov" / "Make-up Sat 16 Nov, 10:00–11:30"
//   detail  why, or which day a make-up replaces: "Storm / bad weather" / "Instead of Wed 13 Nov · Storm …"
export function changeWords(change, i18n) {
    const { t } = i18n;
    const day = changeDay(change.date, i18n);
    const reason = reasonText(change.reason, t);
    if (change.kind === 'cancelled') {
        return {
            title: t('{cls} is off on {day}', { cls: change.class_name, day }),
            line: t('Off on {day}', { day }),
            detail: reason || t('Called off by the studio'),
        };
    }
    const time = [change.start_time, change.end_time].filter(Boolean).map((value) => value.slice(0, 5)).join('–');
    const vars = { cls: change.class_name, day, time };
    return {
        title: time ? t('{cls}: make-up {day}, {time}', vars) : t('{cls}: make-up {day}', vars),
        line: time ? t('Make-up {day}, {time}', vars) : t('Make-up {day}', vars),
        detail: change.makes_up
            ? [t('Instead of {day}', { day: changeDay(change.makes_up, i18n) }), reason].filter(Boolean).join(' · ')
            : t('An extra session'),
    };
}
