import { useI18n } from '@/i18n/i18nContext';
import { ItemChip } from './CalendarItem';
import { isBackground, toIso } from './calendarModel';

const MAX_CHIPS = 3;
const MAX_DOTS = 4;

// 6 × 7 month grid. Desktop: each day lists chips, "+N more" opens that day's week. Phones: each day
// is a button with coloured dots; the picked day's list shows under the grid (see CalendarView).
// Context-only ('background') items stay out of the month: they'd crowd every cell.
const MonthGrid = ({ weeks, month, byDate, today, onSelect, onOpenDay, compact, picked, onPick }) => {
    const { t, tn, dayName, formatDate } = useI18n();
    const monthKey = toIso(month).slice(0, 7);

    return (
        <div className={`calMonth${compact ? ' isCompact' : ''}`} role="grid" aria-label={formatDate(month, 'monthYear')}>
            <div className="calMonthHead" role="row">
                {weeks[0].map((day, index) => (
                    <span key={index} role="columnheader">
                        {dayName(index + 1, 'short')}
                    </span>
                ))}
            </div>
            {weeks.map((week) => (
                <div key={toIso(week[0])} className="calMonthRow" role="row">
                    {week.map((day) => {
                        const iso = toIso(day);
                        const items = (byDate.get(iso) ?? []).filter((item) => !isBackground(item));
                        const state = `${iso === today ? ' isToday' : ''}${iso.slice(0, 7) !== monthKey ? ' isOutside' : ''}${iso < today ? ' isPast' : ''}`;
                        if (compact) {
                            return (
                                <button
                                    key={iso}
                                    type="button"
                                    role="gridcell"
                                    className={`calCell${state}${iso === picked ? ' isPicked' : ''}`}
                                    aria-selected={iso === picked}
                                    aria-label={`${formatDate(iso, 'long')}, ${tn(items.length, '{count} item', '{count} items')}`}
                                    onClick={() => onPick(iso)}
                                >
                                    <span className="calCellNum">{day.getDate()}</span>
                                    <span className="calDots" aria-hidden="true">
                                        {items.slice(0, MAX_DOTS).map((item) => (
                                            <span key={item.id} className={`calDot tone-${item.tone ?? 'solid'}`} style={{ '--cal-accent': item.color }} />
                                        ))}
                                    </span>
                                </button>
                            );
                        }
                        const shown = items.length > MAX_CHIPS ? items.slice(0, MAX_CHIPS - 1) : items;
                        return (
                            <div key={iso} role="gridcell" className={`calCell${state}`}>
                                <button
                                    type="button"
                                    className="calCellNum"
                                    aria-label={t('Open the week of {date}', { date: formatDate(iso, 'long') })}
                                    onClick={() => onOpenDay(iso)}
                                >
                                    {day.getDate()}
                                </button>
                                <div className="calCellItems">
                                    {shown.map((item) => (
                                        <ItemChip key={item.id} item={item} onSelect={onSelect} />
                                    ))}
                                    {items.length > shown.length && (
                                        <button type="button" className="calMore" onClick={() => onOpenDay(iso)}>
                                            {t('+{count} more', { count: items.length - shown.length })}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default MonthGrid;
