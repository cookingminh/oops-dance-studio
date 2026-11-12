import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { compactVnd } from '../../../expenses/expensesModel';
import { sessionState } from '../../hubModel';
import { monthGrid, sessionPlace } from './moneyDays';

// The month as a grid (Monday first): each day shows what came in (green) and went out (red), and a dot for
// the class's session that day (its time, and its room at a rented studio). Every day of the month opens the
// day dialog, quiet ones too (to add a cost on that day). Narrow grids (phones) show short amounts.
//   days: moneyDays.monthDays()   places: { venues, rooms, ownRooms } for sessionPlace()
const MoneyCalendar = ({ cls, month, days, today, now, places, onOpen, busy = false }) => {
    const { t, dayName, formatDate, monthName, intl } = useI18n();
    const weeks = monthGrid(month);

    const describe = (day) => {
        const parts = [formatDate(day.date, 'long')];
        if (day.date === today) parts.push(t('Today'));
        if (day.in) parts.push(t('{amount} in', { amount: formatVnd(day.in) }));
        if (day.out) parts.push(t('{amount} out', { amount: formatVnd(day.out) }));
        if (day.session) {
            const state = sessionState(day.session, today, now);
            const place = sessionPlace(day.session, cls, places).label;
            parts.push(
                [t('Session {start}–{end}', { start: day.session.start, end: day.session.end }), t(state.key, state.vars), place].filter(Boolean).join(', ')
            );
        }
        return parts.join('. ');
    };

    return (
        <div className={`mcCal${busy ? ' isBusy' : ''}`} role="group" aria-label={t('Money by day in {month}', { month: monthName(month, { withYear: true }) })}>
            <div className="mcWeekdays" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <span key={day}>
                        <span className="mcLong">{dayName(day, 'short')}</span>
                        <span className="mcShort">{dayName(day, 'narrow')}</span>
                    </span>
                ))}
            </div>
            {weeks.map((week) => (
                <div key={week.find(Boolean)} className="mcWeek">
                    {week.map((date, index) => {
                        if (!date) return <span key={`blank-${index}`} className="mcBlank" aria-hidden="true" />;
                        const day = days.get(date);
                        const session = day.session;
                        const state = session ? sessionState(session, today, now) : null;
                        const place = session ? sessionPlace(session, cls, places) : null;
                        const quiet = !day.in && !day.out && !session;
                        const classes = ['mcDay', date === today && 'isToday', quiet && 'isQuiet', date > today && 'isAhead'].filter(Boolean).join(' ');
                        return (
                            <button key={date} type="button" className={classes} aria-label={describe(day)} onClick={() => onOpen(date)}>
                                <span className="mcDayNum">{Number(date.slice(8))}</span>
                                {session && (
                                    <span className={`mcSession tone-${state.tone}${state.kind === 'cancelled' ? ' isOff' : ''}`} title={place.label || undefined}>
                                        <span className="mcDot" aria-hidden="true" />
                                        <span className="mcSessionText">{[session.start, place.room?.name].filter(Boolean).join(' · ')}</span>
                                    </span>
                                )}
                                <span className="mcAmounts">
                                    {day.in > 0 && (
                                        <span className="mcIn">
                                            <span className="mcLong">+{formatVnd(day.in)}</span>
                                            <span className="mcShort">+{compactVnd(day.in, intl)}</span>
                                        </span>
                                    )}
                                    {day.out > 0 && (
                                        <span className="mcOut">
                                            <span className="mcLong">−{formatVnd(day.out)}</span>
                                            <span className="mcShort">−{compactVnd(day.out, intl)}</span>
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ))}
            <p className="mcLegend" aria-hidden="true">
                <span className="mcKeyIn">{t('Money in')}</span>
                <span className="mcKeyOut">{t('Money out')}</span>
                <span className="mcKeySession">{t('Session (room at a rented studio)')}</span>
            </p>
        </div>
    );
};

export default MoneyCalendar;
