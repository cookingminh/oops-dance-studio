import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import { useStudioClock } from '../useStudioClock';
import { EASE_OUT } from '../motion';
import AgendaList from './AgendaList';
import CalendarToolbar from './CalendarToolbar';
import { ItemRow } from './CalendarItem';
import MonthGrid from './MonthGrid';
import WeekGrid from './WeekGrid';
import { asDate, calendarRange, itemsByDate, monthWeeks, shiftDate, studioTodayIso, toIso, weekDays } from './calendarModel';
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery';
import './calendar.scss';

// Shared week / month calendar for the admin pages (bookings, class sessions, attendance).
// Controlled: the page owns `view` and `date` and loads the items of calendarRange(view, date).
//
// items: [{ id, date: 'yyyy-MM-dd', start: 'HH:mm', end: 'HH:mm', title, subtitle, color, status,
//           statusLabel?, tone: 'solid' | 'dashed' | 'muted' | 'background', badge, lane?, data }]
// Optional extras beyond the brief: `today` ('yyyy-MM-dd', the studio's date; defaults to the
// studio-timezone date of this device), `label` (accessible name of the calendar), `slotLabel` (what a
// free-slot click does, e.g. "New booking"), `className`.
// `lanes` ([{ id, label, short?, color }], off by default): the desktop week view splits every day
// into one sub-column per lane (e.g. rooms) in this order, even when empty; items go to the lane
// matching `item.lane`. Month view and the phone agenda ignore lanes.
// onSlotClick(date, 'HH:mm', { lane, end? }): a click on a free slot, or a press-and-drag over several
// (week view, mouse / pen; touch taps). `end` comes only with a dragged range longer than one slot;
// `lane` is the lane's id (undefined without lanes). The phone agenda's "+" passes a null time.
const CalendarView = ({
    view = 'week',
    onViewChange,
    date,
    onDateChange,
    items = [],
    onSelect,
    onSlotClick,
    minHour = 8,
    maxHour = 22,
    toolbarExtra,
    loading = false,
    today,
    label,
    slotLabel,
    lanes,
    className = '',
}) => {
    const { t, formatDate } = useI18n();
    const isPhone = useMediaQuery(PHONE_QUERY);
    const now = useStudioClock();
    const todayIso = today ?? studioTodayIso();
    const current = asDate(date);
    const range = calendarRange(view, current);
    const byDate = itemsByDate(items);

    // Slide the new period in from the side we moved towards.
    const direction = useRef(1);
    const step = (by) => {
        direction.current = by;
        onDateChange?.(shiftDate(view, current, by));
    };
    const goToday = () => {
        direction.current = todayIso >= range.from ? 1 : -1;
        onDateChange?.(asDate(todayIso));
    };
    const openDay = (iso) => {
        onDateChange?.(asDate(iso));
        onViewChange?.('week');
    };

    // Phones, month view: the tapped day's list under the grid (today, or the 1st of the month).
    const [pickedDay, setPickedDay] = useState(null);
    const monthKey = toIso(current).slice(0, 7);
    const picked = pickedDay?.startsWith(monthKey) ? pickedDay : todayIso.startsWith(monthKey) ? todayIso : `${monthKey}-01`;

    const isMonth = view === 'month';
    const showsToday = todayIso >= range.from && todayIso <= range.until && (!isMonth || todayIso.startsWith(monthKey));

    let body;
    if (isMonth) {
        body = (
            <>
                <MonthGrid
                    weeks={monthWeeks(current)}
                    month={current}
                    byDate={byDate}
                    today={todayIso}
                    onSelect={onSelect}
                    onOpenDay={openDay}
                    compact={isPhone}
                    picked={picked}
                    onPick={setPickedDay}
                />
                {isPhone && (
                    <section className="calPicked" aria-label={formatDate(picked, 'long')}>
                        <h4>{formatDate(picked, 'long')}</h4>
                        {(byDate.get(picked) ?? []).length === 0 ? (
                            <p className="calAgendaEmpty">{t('Nothing planned')}</p>
                        ) : (
                            <div className="calAgendaItems">
                                {byDate.get(picked).map((item) => (
                                    <ItemRow key={item.id} item={item} onSelect={onSelect} />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </>
        );
    } else if (isPhone) {
        body = (
            <AgendaList
                dates={weekDays(current).map(toIso)}
                byDate={byDate}
                today={todayIso}
                onSelect={onSelect}
                onSlotClick={onSlotClick}
                slotLabel={slotLabel}
            />
        );
    } else {
        body = (
            <WeekGrid
                days={weekDays(current)}
                byDate={byDate}
                today={todayIso}
                now={now}
                minHour={minHour}
                maxHour={maxHour}
                lanes={lanes}
                onSelect={onSelect}
                onSlotClick={onSlotClick}
                slotLabel={slotLabel}
            />
        );
    }

    return (
        <div className={`calendarView is-${view}${isPhone ? ' isPhone' : ''}${loading ? ' isLoading' : ''} ${className}`} aria-busy={loading} aria-label={label} role={label ? 'region' : undefined}>
            <CalendarToolbar
                view={view}
                date={current}
                onStep={step}
                onToday={goToday}
                onViewChange={onViewChange}
                extra={toolbarExtra}
                isToday={showsToday}
            />
            <div className="calFrame">
                {loading && <span className="calProgress" aria-hidden="true" />}
                <motion.div
                    key={`${view}-${range.from}-${isPhone}-${lanes?.length ?? 0}`}
                    className="calStage"
                    initial={{ opacity: 0, x: direction.current * 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                    {body}
                </motion.div>
            </div>
        </div>
    );
};

export default CalendarView;
