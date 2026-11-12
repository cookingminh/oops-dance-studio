import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/i18nContext';
import { ItemBlock } from './CalendarItem';
import WeekTrack from './WeekTrack';
import { SLOT_MINUTES, isBackground, layoutDay, minutesOf, timeOf, toIso } from './calendarModel';
import { useSlotDrag } from './useSlotDrag';

// Time grid: a gutter of hours and 7 day columns made of half-hour slots. Items sit on top of the
// slots (absolutely placed). With `lanes` every day is split into one sub-column per lane (rooms),
// in a fixed order, and each item goes to the lane named by `item.lane`. A press-and-drag (or a click)
// on free slots calls onSlotClick(date, 'HH:mm', { lane, end? }).
const WeekGrid = ({ days, byDate, today, now, minHour, maxHour, lanes, onSelect, onSlotClick, slotLabel }) => {
    const { t, dayName, formatDate } = useI18n();
    const scrollRef = useRef(null);
    const range = { start: minHour * 60, end: maxHour * 60 };
    const slots = Array.from({ length: (range.end - range.start) / SLOT_MINUTES }, (_, index) => timeOf(range.start + index * SLOT_MINUTES));
    const hours = Array.from({ length: maxHour - minHour }, (_, index) => minHour + index);
    const isos = days.map(toIso);
    const showsToday = isos.includes(today);
    const nowMinutes = minutesOf(now);
    // Outside the hours shown, "now" stays on today's column: pinned to the top (before opening) or the
    // bottom (after closing), dashed and with the time, so it isn't read as the first or last hour.
    const nowOutside = nowMinutes < range.start ? 'before' : nowMinutes > range.end ? 'after' : null;
    const nowAt = Math.min(Math.max(nowMinutes, range.start), range.end);
    const hasLanes = Boolean(lanes?.length);
    const { drag, handlersFor } = useSlotDrag({ range, onPick: onSlotClick });

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
        // A grid wider than the card (lanes): scroll just enough to show today's column.
        const todayColumn = scroller.querySelector('.calDay.isToday');
        const hidden = todayColumn ? todayColumn.offsetLeft + todayColumn.offsetWidth - scroller.clientWidth : 0;
        scroller.scrollLeft = hasLanes && hidden > 0 ? hidden : 0;
        // Only when the week changes: later data loads shouldn't yank the view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekKey, Number.isFinite(firstStart), hasLanes]);

    const nowLine = (iso) =>
        iso === today && (
            <span
                className={`calNow${nowOutside ? ` isOutside is-${nowOutside}` : ''}`}
                style={{ top: `${((nowAt - range.start) / (range.end - range.start)) * 100}%` }}
                aria-hidden="true"
            >
                {nowOutside && <span className="calNowTime">{t('Now {time}', { time: now })}</span>}
            </span>
        );
    const trackProps = { slots, range, onSelect, selectable: Boolean(onSlotClick), slotLabel, drag };

    return (
        <div className="calWeekScroll" ref={scrollRef}>
            <div
                className={`calWeek${hasLanes ? ' hasLanes' : ''}${drag ? ' isDragging' : ''}`}
                style={{ '--cal-slots': slots.length, ...(hasLanes ? { '--cal-lanes': lanes.length } : {}) }}
            >
                <div className="calWeekHead">
                    <span className="calGutter" aria-hidden="true" />
                    {days.map((day, index) => (
                        <div key={isos[index]} className={`calDayHead${isos[index] === today ? ' isToday' : ''}`}>
                            <span>{dayName(index + 1, 'short')}</span>
                            <strong>{day.getDate()}</strong>
                            {isos[index] === today && <span className="sr-only">{t('Today')}</span>}
                            {hasLanes && (
                                <div className="calLaneHeads" aria-hidden="true">
                                    {lanes.map((lane) => (
                                        <div key={lane.id} className="calLaneHead" title={lane.label} style={{ '--cal-accent': lane.color }}>
                                            <i className="calDot" />
                                            <b>{lane.short ?? lane.label}</b>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                        const dayClass = `calDay${iso === today ? ' isToday' : ''}${iso < today ? ' isPast' : ''}`;
                        if (!hasLanes) {
                            return (
                                <WeekTrack
                                    key={iso}
                                    {...trackProps}
                                    className={dayClass}
                                    date={iso}
                                    items={dayItems}
                                    handlers={handlersFor(iso, undefined)}
                                    data-date={iso}
                                    role="group"
                                    aria-label={formatDate(iso, 'full')}
                                >
                                    {nowLine(iso)}
                                </WeekTrack>
                            );
                        }
                        const laneIds = new Set(lanes.map((lane) => String(lane.id)));
                        // An item naming no known lane spans the whole day.
                        const unlaned = layoutDay(dayItems.filter((item) => !laneIds.has(String(item.lane))));
                        return (
                            <div key={iso} className={dayClass} data-date={iso} role="group" aria-label={formatDate(iso, 'full')}>
                                {lanes.map((lane) => (
                                    <WeekTrack
                                        key={lane.id}
                                        {...trackProps}
                                        className="calLane"
                                        date={iso}
                                        lane={lane}
                                        items={dayItems.filter((item) => String(item.lane) === String(lane.id))}
                                        handlers={handlersFor(iso, lane.id)}
                                        data-lane={lane.id}
                                        role="group"
                                        aria-label={lane.label}
                                    />
                                ))}
                                {unlaned.map(({ item, column, columns }) => (
                                    <ItemBlock key={item.id} item={item} column={column} columns={columns} range={range} onSelect={onSelect} />
                                ))}
                                {nowLine(iso)}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default WeekGrid;
