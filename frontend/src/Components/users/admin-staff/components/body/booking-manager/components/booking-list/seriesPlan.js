import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { discounted, previewSeries } from '@/services/bookingSeries';
import { isoWeekdayOf, toMinutes } from '@/lib/format';
import { listPriceFor } from '../../bookingsModel';

export const SKIP = 'skip';
export const OTHER_TIME = 'time';
export const plusDays = (iso, days) => format(addDays(parseISO(iso), days), 'yyyy-MM-dd');

// How long a series runs from its first day: n weeks (the last day is the day before the (n+1)th).
export const RUNS = [4, 8, 12];
export const untilFor = (date, weeks) => plusDays(date, weeks * 7 - 1);

// What holds a room, as the server words it (room_clash_on), in the viewer's language.
export function clashWords(text, t) {
    let match = /^a booking (\S+)$/.exec(text ?? '');
    if (match) return t('a booking {time}', { time: match[1] });
    match = /^class "(.+)" (\S+)$/.exec(text ?? '');
    if (match) return t('class {name} {time}', { name: match[1], time: match[2] });
    match = /^a make-up session of "(.+)" (\S+)$/.exec(text ?? '');
    if (match) return t('a make-up of {name} {time}', { name: match[1], time: match[2] });
    match = /^a session of "(.+)" (\S+) placed there that day$/.exec(text ?? '');
    if (match) return t('a session of {name} {time}', { name: match[1], time: match[2] });
    return text;
}

// A new booking repeated every week (staff): which weekdays, until when, what happens on each day the room is
// taken (another free room, other times, or skip it), a discount for the series (a percentage or an amount off
// each session, with its reason), and what each month comes to — the renter pays by month, one QR code per month.
// The form's room, first day and times are the weekly slot; with `perDay` each weekday has its own times (the first
// day's weekday keeps the form's: onMainTimes({ start?, end? }) changes them). Every day of the series is checked on
// the server at its times (booking_series_preview: what holds the room, which rooms are free instead).
// Each day's `status`: 'free', 'moved' (another room, or other times that are free), 'clash' (other times that
// aren't free, or not checked yet) or 'skipped'. `plan` is what booking_series_create takes, `problem` why not yet.
export function useSeriesPlan({ active, rooms, roomId, date, startTime, endTime, onMainTimes, t }) {
    // The weekdays follow the first day's until staff pick some; it runs n weeks from the first day (8 at first, still
    // n weeks when the first day moves) or up to a day staff typed.
    const [pickedDays, setPickedDays] = useState(null);
    const [run, setRun] = useState({ weeks: 8 }); // { weeks } | { until }
    const [choices, setChoices] = useState({}); // date → { mode: room id | 'time' | 'skip', start, end, ok }
    const [discount, setDiscount] = useState({ kind: 'none', value: '', note: '' });
    const ownDay = date ? [isoWeekdayOf(date)] : [];
    const weekdays = pickedDays ?? ownDay;
    const until = !date ? '' : run.weeks ? untilFor(date, run.weeks) : run.until;
    const sorted = [...weekdays].sort();
    const weekKey = sorted.join(',');

    // Times per weekday: the same for all (the form's), or each weekday its own (only with two weekdays or more).
    const [perDay, setPerDay] = useState(false);
    const [ownTimes, setOwnTimes] = useState({}); // weekday → { start, end }, the first day's weekday aside
    const firstWeekday = date ? isoWeekdayOf(date) : null;
    const main = { start: startTime, end: endTime };
    const byWeekday = perDay && sorted.length > 1;
    const timesOf = (weekday) => (!byWeekday || weekday === firstWeekday ? main : { ...main, ...ownTimes[weekday] });
    const setTimesOf = (weekday, patch) =>
        weekday === firstWeekday ? onMainTimes(patch) : setOwnTimes((old) => ({ ...old, [weekday]: { ...main, ...old[weekday], ...patch } }));
    const timesValid = sorted.every((weekday) => {
        const times = timesOf(weekday);
        return times.start && times.end && toMinutes(times.end) > toMinutes(times.start);
    });
    // What the server takes: null when every weekday is at the form's times.
    const dayTimes = byWeekday && sorted.some((weekday) => timesOf(weekday).start !== startTime || timesOf(weekday).end !== endTime)
        ? Object.fromEntries(sorted.map((weekday) => [weekday, timesOf(weekday)]))
        : null;
    const timesKey = JSON.stringify(dayTimes);

    const ready = Boolean(active && roomId && date && startTime && endTime && toMinutes(endTime) > toMinutes(startTime) && weekdays.length && until && until >= date && timesValid);
    const preview = useAsync(
        () => (ready ? previewSeries({ roomId, weekdays: sorted, start: startTime, end: endTime, from: date, until, dayTimes }) : Promise.resolve([])),
        [ready, roomId, weekKey, startTime, endTime, date, until, timesKey] // weekKey and timesKey stand for the weekdays and their times
    );
    const days = useMemo(() => (ready ? preview.data ?? [] : []), [ready, preview.data]);

    // A taken day starts on the first free room, else skipped.
    const choiceOf = (day) => choices[day.date] ?? { mode: day.free_rooms[0] ? String(day.free_rooms[0].id) : SKIP, start: day.start, end: day.end, ok: false };
    const setChoice = (dayDate, patch) => setChoices((old) => ({ ...old, [dayDate]: { ...(old[dayDate] ?? {}), ...patch } }));

    // Where and when each day happens (the server gives each day its weekday's times).
    const slotOf = (day) => {
        const usual = { roomId: String(roomId), start: day.start, end: day.end };
        if (!day.clash) return { status: 'free', ...usual };
        const choice = choiceOf(day);
        if (choice.mode === SKIP) return { status: 'skipped', ...usual };
        if (choice.mode === OTHER_TIME) return { status: choice.ok ? 'moved' : 'clash', ...usual, start: choice.start, end: choice.end, otherTime: true };
        return { status: 'moved', ...usual, roomId: String(choice.mode), otherRoom: true };
    };
    const slots = days.map((day) => ({ ...day, ...slotOf(day) }));
    const kept = slots.filter((day) => day.status !== 'skipped');

    const hasDiscount = discount.kind !== 'none';
    const value = Number(discount.value);
    const discountProblem = !hasDiscount
        ? ''
        : !discount.value || !Number.isFinite(value) || value <= 0 || (discount.kind === 'percent' && value >= 100)
            ? t(discount.kind === 'percent' ? 'Enter 1–99 %.' : 'Enter the amount off each session.')
            : !discount.note.trim()
                ? t('Say why there is a discount.')
                : '';
    const discountOut = hasDiscount ? { kind: discount.kind, value, note: discount.note } : null;

    // What each month comes to: the room's price for each session kept, less the discount.
    const roomOf = (id) => rooms.find((room) => String(room.id) === String(id));
    const months = new Map();
    for (const day of kept) {
        const list = listPriceFor(roomOf(day.roomId), day.start, day.end) ?? 0;
        const key = day.date.slice(0, 7);
        const row = months.get(key) ?? { sessions: 0, list: 0, total: 0 };
        row.sessions += 1;
        row.list += list;
        row.total += discounted(list, discountOut) ?? 0;
        months.set(key, row);
    }
    const total = [...months.values()].reduce((sum, row) => sum + row.total, 0);

    const problem = !ready
        ? timesValid
            ? t('Pick the room, the first day and the times, then the weekdays and the last day.')
            : t('Each weekday’s end time must be after its start.')
        : preview.loading
            ? t('Checking the days…')
            : kept.length === 0
                ? days.length === 0
                    ? t('No day left to book in that range.')
                    : t('Keep at least one day.')
                : kept.some((day) => day.status === 'clash')
                    ? t('A day moved to other times isn’t free then.')
                    : discountProblem;

    return {
        ready,
        startTime,
        endTime,
        loading: ready && preview.loading,
        error: preview.error,
        weekdays: sorted,
        timesValid,
        perDay,
        setPerDay,
        byWeekday,
        firstWeekday,
        timesOf,
        setTimesOf,
        toggleDay: (day) =>
            setPickedDays((old) => {
                const base = old ?? ownDay;
                return base.includes(day) ? base.filter((item) => item !== day) : [...base, day];
            }),
        until,
        weeks: run.weeks ?? null,
        setWeeks: (weeks) => setRun({ weeks }),
        setUntil: (value) => setRun({ until: value }),
        discount,
        setDiscount: (patch) => setDiscount((old) => ({ ...old, ...patch })),
        discountProblem,
        days: slots,
        choiceOf,
        setChoice,
        kept,
        months,
        total,
        problem,
        plan: {
            weekdays: sorted,
            until,
            days: kept.map((day) =>
                day.otherTime ? { date: day.date, start: day.start, end: day.end } : day.otherRoom ? { date: day.date, room_id: Number(day.roomId) } : { date: day.date }
            ),
            discount: discountOut,
            dayTimes,
            count: kept.length,
        },
    };
}
