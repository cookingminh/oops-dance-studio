import { useEffect, useRef, useState } from 'react';
import { Button, Select, SelectItem } from '@nextui-org/react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { previewSeries } from '@/services/bookingSeries';
import { TIME_OPTIONS, isoWeekdayOf, toMinutes } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { monthWeeks, toIso } from '../../../../common/calendar/calendarModel';
import { capitalized, guestName, slotClashes } from '../../bookingsModel';
import { OTHER_TIME, SKIP, clashWords } from './seriesPlan';

const POPOVER = { popoverContent: 'adminPortal' };
const STATUS_WORDS = { free: 'Free', moved: 'Another room or time', clash: 'Still clashes', skipped: 'Skipped' };

// One taken day moved to other times: is the room free then?
const TimeFix = ({ roomId, date, start, end, onStart, onEnd, onState }) => {
    const { t } = useI18n();
    const valid = start && end && toMinutes(end) > toMinutes(start);
    const check = useAsync(
        () => (valid ? previewSeries({ roomId, weekdays: [isoWeekdayOf(date)], start, end, from: date, until: date }) : Promise.resolve(null)),
        [roomId, date, start, end, valid]
    );
    const clash = check.data?.[0]?.clash ?? null;
    const ok = valid && !check.loading && check.data && check.data.length === 1 && !clash;
    // Reported when it changes only (onState is a new function on every render).
    const report = useRef(onState);
    useEffect(() => {
        report.current = onState;
    });
    useEffect(() => report.current(Boolean(ok)), [ok]);
    return (
        <div className="sdTimeFix">
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
            <span className={`sdFixState${ok ? ' isOk' : ''}`} role="status">
                {!valid ? t('Pick the times') : check.loading ? t('Checking…') : ok ? t('Free then') : clash ? t('Taken: {what}', { what: clashWords(clash, t) }) : t('Not possible that day')}
            </span>
        </div>
    );
};

// The days of a weekly series on a month calendar, coloured by what happens on each (free, moved to another room or
// time, still clashing, skipped), and the taken days with the choice for each: another free room, other times, or
// skip it. A day picked here (`selected`) shows on the day preview below: onSelect(date).
const SeriesDays = ({ series, roomId, bookings, selected, onSelect }) => {
    const { t, tn, dayName, formatDate, monthName } = useI18n();
    const first = series.days[0]?.date;
    const last = series.days.at(-1)?.date;
    const [month, setMonth] = useState(() => (selected ?? first ?? '').slice(0, 7));
    // The month follows the day picked (on the list of taken days, or the day arrows).
    useEffect(() => {
        if (selected) setMonth(selected.slice(0, 7));
    }, [selected]);
    const shown = month && first && month >= first.slice(0, 7) && month <= last.slice(0, 7) ? month : (first ?? '').slice(0, 7);
    if (!shown) return null;

    const byDate = new Map(series.days.map((day) => [day.date, day]));
    const months = [...new Set(series.days.map((day) => day.date.slice(0, 7)))];
    const at = months.indexOf(shown);
    const weeks = monthWeeks(`${shown}-01`).filter((week) => week.some((day) => toIso(day).startsWith(shown)));
    const inMonth = series.days.filter((day) => day.date.startsWith(shown)).length;
    const taken = series.days.filter((day) => day.clash);

    // What holds the room that day: the booking itself when the page has it, else the server's words.
    const holder = (day) => {
        const clash = slotClashes({ bookings, roomId, date: day.date, start: series.startTime, end: series.endTime }).find((row) => row.kind === 'booking');
        return clash ? t('{name}’s booking {time}', { name: guestName(clash.booking, t), time: `${clash.start}–${clash.end}` }) : clashWords(day.clash, t);
    };

    return (
        <div className="sdBox">
            <div className="sdMonthBar">
                <Button isIconOnly size="sm" variant="light" aria-label={t('Previous month')} isDisabled={at <= 0} onPress={() => setMonth(months[at - 1])}>
                    <LuChevronLeft aria-hidden="true" />
                </Button>
                <p>
                    <strong>{capitalized(monthName(`${shown}-01`, { withYear: true }))}</strong>
                    <span>{tn(inMonth, '{count} session', '{count} sessions')}</span>
                </p>
                <Button isIconOnly size="sm" variant="light" aria-label={t('Next month')} isDisabled={at >= months.length - 1} onPress={() => setMonth(months[at + 1])}>
                    <LuChevronRight aria-hidden="true" />
                </Button>
            </div>
            <div className="sdGrid" role="group" aria-label={t('Days of the series')}>
                {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                    <span key={weekday} className="sdWeekday" aria-hidden="true">
                        {dayName(weekday, 'short')}
                    </span>
                ))}
                {weeks.flat().map((day) => {
                    const iso = toIso(day);
                    const entry = byDate.get(iso);
                    const outside = !iso.startsWith(shown);
                    if (!entry || outside) {
                        return (
                            <span key={iso} className={`sdCell${outside ? ' isOutside' : ''}`} aria-hidden="true">
                                {day.getDate()}
                            </span>
                        );
                    }
                    return (
                        <button
                            key={iso}
                            type="button"
                            className={`sdCell isDay is-${entry.status}`}
                            aria-pressed={iso === selected}
                            aria-label={`${formatDate(iso, 'short')} · ${t(STATUS_WORDS[entry.status])}`}
                            title={`${formatDate(iso, 'short')} · ${t(STATUS_WORDS[entry.status])}`}
                            onClick={() => onSelect(iso)}
                        >
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>
            <ul className="sdLegend" aria-label={t('Legend')}>
                {Object.entries(STATUS_WORDS).map(([status, words]) => (
                    <li key={status}>
                        <i className={`is-${status}`} aria-hidden="true" />
                        {t(words)}
                    </li>
                ))}
            </ul>

            {taken.length > 0 && (
                <div className="sdTaken">
                    <p className="sdTakenTitle">{tn(taken.length, '{count} taken day: what to do', '{count} taken days: what to do')}</p>
                    <ul>
                        {taken.map((day) => {
                            const choice = series.choiceOf(day);
                            return (
                                <li key={day.date} className={`is-${day.status}${day.date === selected ? ' isSelected' : ''}`}>
                                    <button type="button" className="sdTakenDay" onClick={() => onSelect(day.date)}>
                                        <strong>{formatDate(day.date, 'short')}</strong>
                                        <small>{t('Taken: {what}', { what: holder(day) })}</small>
                                    </button>
                                    <Select
                                        size="sm"
                                        aria-label={t('That day')}
                                        classNames={POPOVER}
                                        selectedKeys={[choice.mode]}
                                        onChange={(event) => {
                                            if (!event.target.value) return;
                                            series.setChoice(day.date, { mode: event.target.value, start: choice.start ?? series.startTime, end: choice.end ?? series.endTime });
                                            onSelect(day.date);
                                        }}
                                        className="sdChoice"
                                    >
                                        {[
                                            ...day.free_rooms.map((room) => (
                                                <SelectItem key={String(room.id)} textValue={t('In {room}', { room: room.name })}>
                                                    {t('In {room}', { room: room.name })}
                                                </SelectItem>
                                            )),
                                            <SelectItem key={OTHER_TIME}>{t('At other times')}</SelectItem>,
                                            <SelectItem key={SKIP}>{t('Skip this day')}</SelectItem>,
                                        ]}
                                    </Select>
                                    {choice.mode === OTHER_TIME && (
                                        <TimeFix
                                            roomId={roomId}
                                            date={day.date}
                                            start={choice.start}
                                            end={choice.end}
                                            onStart={(start) => series.setChoice(day.date, { start })}
                                            onEnd={(end) => series.setChoice(day.date, { end })}
                                            onState={(ok) => series.setChoice(day.date, { ok })}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SeriesDays;
