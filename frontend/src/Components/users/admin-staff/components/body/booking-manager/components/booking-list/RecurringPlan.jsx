import { useEffect, useMemo, useRef, useState } from 'react';
import { Input, Select, SelectItem } from '@nextui-org/react';
import { LuAlertTriangle, LuCheck } from 'react-icons/lu';
import { addDays, format, parseISO } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { discounted, previewSeries } from '@/services/bookingSeries';
import { TIME_OPTIONS, formatVnd, isoWeekdayOf, toMinutes } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import Segmented from '../../../../common/Segmented';
import { listPriceFor } from '../../bookingsModel';

const POPOVER = { popoverContent: 'adminPortal' };
const WEEK = [1, 2, 3, 4, 5, 6, 7];
const SKIP = 'skip';
const OTHER_TIME = 'time';
const plusDays = (iso, days) => format(addDays(parseISO(iso), days), 'yyyy-MM-dd');
// "tháng 12 năm 2026" starts a line: "Tháng 12 năm 2026".
export const capitalized = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);

// What holds a room, as the server words it (room_clash_on), in the viewer's language.
function clashWords(text, t) {
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

// One clashing day moved to other times: is the room (or the room picked for it) free then?
const TimeFix = ({ roomId, date, start, end, onStart, onEnd, onState }) => {
    const { t } = useI18n();
    const valid = start && end && toMinutes(end) > toMinutes(start);
    const check = useAsync(
        () => (valid ? previewSeries({ roomId, weekdays: [isoWeekdayOf(date)], start, end, from: date, until: date }) : Promise.resolve(null)),
        [roomId, date, start, end, valid]
    );
    const clash = check.data?.[0]?.clash ?? null;
    const ok = valid && check.data && check.data.length === 1 && !clash;
    // Reported when it changes only (onState is a new function on every render of the plan).
    const report = useRef(onState);
    useEffect(() => {
        report.current = onState;
    });
    useEffect(() => report.current(Boolean(ok)), [ok]);
    return (
        <div className="rpTimeFix">
            <Select size="sm" label={t('Start')} classNames={POPOVER} selectedKeys={start ? [start] : []} onChange={(event) => onStart(event.target.value)}>
                {TIME_OPTIONS.slice(0, -1).map((time) => (
                    <SelectItem key={time}>{time}</SelectItem>
                ))}
            </Select>
            <Select size="sm" label={t('End')} classNames={POPOVER} selectedKeys={end ? [end] : []} onChange={(event) => onEnd(event.target.value)}>
                {TIME_OPTIONS.slice(1).map((time) => (
                    <SelectItem key={time}>{time}</SelectItem>
                ))}
            </Select>
            <span className={`rpFixState${ok ? ' isOk' : ''}`} role="status">
                {!valid ? t('Pick the times') : check.loading ? t('Checking…') : ok ? t('Free then') : clash ? t('Taken: {what}', { what: clashWords(clash, t) }) : t('Not possible that day')}
            </span>
        </div>
    );
};

// A new booking repeated every week (staff): which weekdays, until when, what happens on a day the room is taken
// (another free room, other times, or skip it), a discount for the series (a percentage or an amount off each
// session, with its reason), and what each month comes to — the renter pays by month, one QR code per month.
// onChange({ ready, problem, weekdays, until, days, discount, count }) whenever the plan changes.
const RecurringPlan = ({ rooms, roomId, date, startTime, endTime, onChange }) => {
    const { t, tn, dayName, formatDate, monthName } = useI18n();
    const [weekdays, setWeekdays] = useState(() => (date ? [isoWeekdayOf(date)] : []));
    const [until, setUntil] = useState(() => (date ? plusDays(date, 49) : ''));
    const [choices, setChoices] = useState({}); // date → { mode: room id | 'time' | 'skip', start, end, ok }
    const [discount, setDiscount] = useState({ kind: 'none', value: '', note: '' });
    // The first day picked (or moved) after the plan opened: its weekday, and eight weeks.
    useEffect(() => {
        if (!date) return;
        setWeekdays((old) => (old.length ? old : [isoWeekdayOf(date)]));
        setUntil((old) => (old && old >= date ? old : plusDays(date, 49)));
    }, [date]);

    const ready = Boolean(roomId && date && startTime && endTime && toMinutes(endTime) > toMinutes(startTime) && weekdays.length && until && until >= date);
    const weekKey = [...weekdays].sort().join(',');
    const preview = useAsync(
        () => (ready ? previewSeries({ roomId, weekdays: [...weekdays].sort(), start: startTime, end: endTime, from: date, until }) : Promise.resolve([])),
        [ready, roomId, weekKey, startTime, endTime, date, until]
    );
    const days = useMemo(() => preview.data ?? [], [preview.data]);

    // A clashing day starts on the first free room, else skipped.
    const choiceOf = (day) => choices[day.date] ?? { mode: day.free_rooms[0] ? String(day.free_rooms[0].id) : SKIP, start: startTime, end: endTime, ok: false };
    const setChoice = (dayDate, patch) => setChoices((old) => ({ ...old, [dayDate]: { ...(old[dayDate] ?? {}), ...patch } }));

    const kept = days
        .map((day) => {
            if (!day.clash) return { date: day.date };
            const choice = choiceOf(day);
            if (choice.mode === SKIP) return null;
            if (choice.mode === OTHER_TIME) return { date: day.date, start: choice.start, end: choice.end, ok: choice.ok };
            return { date: day.date, room_id: Number(choice.mode) };
        })
        .filter(Boolean);

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
        const list = listPriceFor(roomOf(day.room_id ?? roomId), day.start ?? startTime, day.end ?? endTime) ?? 0;
        const key = day.date.slice(0, 7);
        const row = months.get(key) ?? { sessions: 0, list: 0, total: 0 };
        row.sessions += 1;
        row.list += list;
        row.total += discounted(list, discountOut) ?? 0;
        months.set(key, row);
    }

    const problem = !ready
        ? t('Pick the room, the first day and the times, then the weekdays and the last day.')
        : preview.loading
            ? t('Checking the days…')
            : kept.length === 0
                ? t('Keep at least one day.')
                : kept.some((day) => day.ok === false)
                    ? t('A day moved to other times isn’t free then.')
                    : discountProblem;
    const keptKey = JSON.stringify(kept);
    useEffect(() => {
        onChange({
            ready: !problem,
            problem,
            weekdays: [...weekdays].sort(),
            until,
            days: kept.map((day) => Object.fromEntries(Object.entries(day).filter(([key]) => key !== 'ok'))),
            discount: discountOut,
            count: kept.length,
        });
        // keptKey stands for `kept` (rebuilt every render).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [problem, weekKey, until, keptKey, discount.kind, discount.value, discount.note]);

    const toggleDay = (day) => setWeekdays((old) => (old.includes(day) ? old.filter((item) => item !== day) : [...old, day]));
    const clashes = days.filter((day) => day.clash).length;

    return (
        <div className="rpPlan">
            <div className="rpRow">
                <span className="bfLabel">{t('Every')}</span>
                <div className="rpWeekdays" role="group" aria-label={t('Weekdays')}>
                    {WEEK.map((day) => (
                        <button key={day} type="button" aria-pressed={weekdays.includes(day)} onClick={() => toggleDay(day)}>
                            {dayName(day, 'short')}
                        </button>
                    ))}
                </div>
                <Input type="date" label={t('Until')} value={until} min={date || undefined} onValueChange={setUntil} className="rpUntil" />
            </div>

            {ready && (
                <div className="rpDays">
                    <p className="rpCount">
                        {preview.loading
                            ? t('Checking the days…')
                            : [tn(days.length, '{count} day', '{count} days'), clashes ? tn(clashes, '{count} is taken', '{count} are taken') : t('all free')].join(' · ')}
                    </p>
                    <ul>
                        {days.map((day) => {
                            const choice = choiceOf(day);
                            return (
                                <li key={day.date} className={day.clash ? 'isClash' : ''}>
                                    <span className="rpDay">
                                        {day.clash ? <LuAlertTriangle aria-hidden="true" /> : <LuCheck aria-hidden="true" />}
                                        <strong>{formatDate(day.date, 'short')}</strong>
                                        {day.clash && <small>{t('Taken: {what}', { what: clashWords(day.clash, t) })}</small>}
                                    </span>
                                    {day.clash && (
                                        <Select
                                            size="sm"
                                            aria-label={t('That day')}
                                            classNames={POPOVER}
                                            selectedKeys={[choice.mode]}
                                            onChange={(event) => event.target.value && setChoice(day.date, { mode: event.target.value, start: choice.start ?? startTime, end: choice.end ?? endTime })}
                                            className="rpChoice"
                                        >
                                            {[
                                                ...day.free_rooms.map((room) => (
                                                    <SelectItem key={String(room.id)} textValue={room.name}>
                                                        {t('In {room}', { room: room.name })}
                                                    </SelectItem>
                                                )),
                                                <SelectItem key={OTHER_TIME}>{t('At other times')}</SelectItem>,
                                                <SelectItem key={SKIP}>{t('Skip this day')}</SelectItem>,
                                            ]}
                                        </Select>
                                    )}
                                    {day.clash && choice.mode === OTHER_TIME && (
                                        <TimeFix
                                            roomId={roomId}
                                            date={day.date}
                                            start={choice.start}
                                            end={choice.end}
                                            onStart={(start) => setChoice(day.date, { start })}
                                            onEnd={(end) => setChoice(day.date, { end })}
                                            onState={(ok) => setChoice(day.date, { ok })}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="rpRow">
                <span className="bfLabel">{t('Discount for the series')}</span>
                <Segmented
                    label={t('Discount for the series')}
                    options={[
                        { key: 'none', label: t('None') },
                        { key: 'percent', label: '%' },
                        { key: 'amount', label: t('VND off each session') },
                    ]}
                    value={discount.kind}
                    onChange={(kind) => setDiscount((old) => ({ ...old, kind }))}
                />
            </div>
            {hasDiscount && (
                <div className="rpDiscount">
                    <Input
                        type="number"
                        size="sm"
                        label={discount.kind === 'percent' ? t('Percent off') : t('Amount off each session (VND)')}
                        value={discount.value}
                        onValueChange={(next) => setDiscount((old) => ({ ...old, value: next }))}
                        min={0}
                        step={discount.kind === 'percent' ? 1 : 1000}
                    />
                    <Input
                        size="sm"
                        label={t('Reason')}
                        value={discount.note}
                        onValueChange={(note) => setDiscount((old) => ({ ...old, note }))}
                        maxLength={300}
                        isRequired
                    />
                </div>
            )}

            {months.size > 0 && (
                <div className="rpMonths">
                    <span className="bfLabel">{t('Paid by month')}</span>
                    <ul>
                        {[...months.entries()].map(([key, row]) => (
                            <li key={key}>
                                <strong>{capitalized(monthName(`${key}-01`, { withYear: true }))}</strong>
                                <span>{tn(row.sessions, '{count} session', '{count} sessions')}</span>
                                <span className="rpMoney">
                                    {row.total !== row.list && <s>{formatVnd(row.list)}</s>} {formatVnd(row.total)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="bfMuted">{t('Each month gets its own QR code to send the renter once the series is booked.')}</p>
                </div>
            )}
            {problem && ready && !preview.loading && <p className="bfHint" role="status">{problem}</p>}
        </div>
    );
};

export default RecurringPlan;
