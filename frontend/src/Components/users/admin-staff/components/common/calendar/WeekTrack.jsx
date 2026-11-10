import { useI18n } from '@/i18n/i18nContext';
import { ItemBlock } from './CalendarItem';
import { layoutDay, minutesOf, timeOf, toneOf } from './calendarModel';

// One vertical track of the week grid: a day, or one lane of a day. Half-hour slots underneath,
// the items on top (overlaps side by side), and the ghost of a range being dragged.
const WeekTrack = ({ className, date, lane, items, slots, range, onSelect, selectable, slotLabel, drag, handlers, children, ...attributes }) => {
    const { t, formatDate } = useI18n();
    const placed = layoutDay(items);
    const ghost = drag && drag.date === date && drag.lane === lane?.id ? drag : null;
    // Anything still holding the room in that range (cancelled / past items are muted).
    const clash = ghost && items.find((item) => toneOf(item) !== 'muted' && minutesOf(item.start) < ghost.to && minutesOf(item.end) > ghost.from);
    const span = range.end - range.start;

    return (
        <div className={className} {...attributes} {...handlers}>
            {slots.map((time) => (
                <div
                    key={time}
                    className={`calSlot${time.endsWith(':00') ? ' isHour' : ''}${selectable ? ' isOpen' : ''}`}
                    data-time={time}
                    data-label={selectable ? `+ ${time}` : undefined}
                    title={selectable ? [`${slotLabel ?? t('Add')} · ${formatDate(date, 'short')} ${time}`, lane?.label].filter(Boolean).join(' · ') : undefined}
                    aria-hidden="true"
                />
            ))}
            {placed.map(({ item, column, columns }) => (
                <ItemBlock key={item.id} item={item} column={column} columns={columns} range={range} onSelect={onSelect} />
            ))}
            {ghost && (
                <div
                    className={`calGhost${clash ? ' isClash' : ''}`}
                    style={{ top: `${((ghost.from - range.start) / span) * 100}%`, height: `${((ghost.to - ghost.from) / span) * 100}%` }}
                    aria-hidden="true"
                >
                    <strong>
                        {timeOf(ghost.from)}–{timeOf(ghost.to)}
                    </strong>
                    {clash && <span>{t('Overlaps {name}', { name: clash.title })}</span>}
                </div>
            )}
            {children}
        </div>
    );
};

export default WeekTrack;
