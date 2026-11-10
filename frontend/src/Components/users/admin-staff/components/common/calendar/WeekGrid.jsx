import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/i18nContext';
import { ItemBlock } from './CalendarItem';
import { SLOT_MINUTES, isBackground, layoutDay, minutesOf, timeOf, toIso } from './calendarModel';

// Time grid: a gutter of hours and 7 day columns made of half-hour slots. Items sit on top of the
// slots (absolutely placed); a click on a free slot calls onSlotClick(date, 'HH:mm').
const WeekGrid = ({ days, byDate, today, now, minHour, maxHour, onSelect, onSlotClick, slotLabel }) => {
    const { t, dayName, formatDate } = useI18n();
    const scrollRef = useRef(null);
    const range = { start: minHour * 60, end: maxHour * 60 };
    const slots = Array.from({ length: (range.end - range.start) / SLOT_MINUTES }, (_, index) => timeOf(range.start + index * SLOT_MINUTES));
    const hours = Array.from({ length: maxHour - minHour }, (_, index) => minHour + index);
    const isos = days.map(toIso);
    const showsToday = isos.includes(today);
    const nowMinutes = minutesOf(now);
    const nowVisible = showsToday && nowMinutes >= range.start && nowMinutes <= range.end;

    // Open on "now" in today's week, else just above the first item of the week.
    const firstStart = Math.min(...isos.flatMap((iso) => (byDate.get(iso) ?? []).filter((item) => !isBackground(item)).map((item) => minutesOf(item.start))));
    const anchor = showsToday ? nowMinutes - 90 : Number.isFinite(firstStart) ? firstStart - 30 : range.start;
    const weekKey = isos[0];
    useEffect(() => {
        const scroller = scrollRef.current;
        const slot = scroller?.querySelector('.calSlot');
        if (!scroller || !slot) return;
        const perMinute = slot.offsetHeight / SLOT_MINUTES;
        scroller.scrollTop = Math.max(0, (Math.min(Math.max(anchor, range.start), range.end) - range.start) * perMinute);
        // Only when the week changes: later data loads shouldn't yank the view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekKey, Number.isFinite(firstStart)]);

    return (
        <div className="calWeekScroll" ref={scrollRef}>
            <div className="calWeek" style={{ '--cal-slots': slots.length }}>
                <div className="calWeekHead">
                    <span className="calGutter" aria-hidden="true" />
                    {days.map((day, index) => (
                        <div key={isos[index]} className={`calDayHead${isos[index] === today ? ' isToday' : ''}`}>
                            <span>{dayName(index + 1, 'short')}</span>
                            <strong>{day.getDate()}</strong>
                            {isos[index] === today && <span className="sr-only">{t('Today')}</span>}
                        </div>
                    ))}
                </div>
                <div className="calWeekBody">
                    <div className="calTimes" aria-hidden="true">
                        {hours.map((hour) => (
                            <span key={hour} style={{ top: `${((hour * 60 - range.start) / (range.end - range.start)) * 100}%` }}>
                                {timeOf(hour * 60)}
                            </span>
                        ))}
                    </div>
                    {days.map((day, index) => {
                        const iso = isos[index];
                        const dayItems = byDate.get(iso) ?? [];
                        const placed = layoutDay(dayItems);
                        return (
                            <div
                                key={iso}
                                className={`calDay${iso === today ? ' isToday' : ''}${iso < today ? ' isPast' : ''}`}
                                data-date={iso}
                                role="group"
                                aria-label={formatDate(iso, 'full')}
                            >
                                {slots.map((time) => (
                                    <div
                                        key={time}
                                        className={`calSlot${time.endsWith(':00') ? ' isHour' : ''}${onSlotClick ? ' isOpen' : ''}`}
                                        data-time={time}
                                        data-label={onSlotClick ? `+ ${time}` : undefined}
                                        title={onSlotClick ? `${slotLabel ?? t('Add')} · ${formatDate(iso, 'short')} ${time}` : undefined}
                                        aria-hidden="true"
                                        onClick={onSlotClick ? () => onSlotClick(iso, time) : undefined}
                                    />
                                ))}
                                {placed.map(({ item, column, columns }) => (
                                    <ItemBlock key={item.id} item={item} column={column} columns={columns} range={range} onSelect={onSelect} />
                                ))}
                                {iso === today && nowVisible && (
                                    <span className="calNow" style={{ top: `${((nowMinutes - range.start) / (range.end - range.start)) * 100}%` }} aria-hidden="true" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WeekGrid;
