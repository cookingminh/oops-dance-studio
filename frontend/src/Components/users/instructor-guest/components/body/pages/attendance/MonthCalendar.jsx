import { LuCheck, LuMinus, LuX } from 'react-icons/lu';
import { getDaysInMonth, parseISO } from 'date-fns';
import { useI18n } from '@/i18n/i18nContext';
import { isoWeekdayOf } from '@/lib/format';
import { classHue } from '../../profileHelpers';

const LABELS = { attend: 'Attended', absent: 'Absent', pending: 'Not marked', upcoming: 'Coming up' }; // English, translated where shown
const ICONS = { attend: LuCheck, absent: LuX, pending: LuMinus }; // sessions to come: a dot in the class's colour
// A day with several sessions takes the colour of the one that needs the most attention.
const PRIORITY = ['absent', 'pending', 'attend', 'upcoming'];

// One month, Monday first. Each day shows its roll calls (✓ attended, ✗ missed, – not marked)
// and, after today, the sessions still to come (a dot in the class's colour).
const MonthCalendar = ({ month, today, rows, classes }) => {
    const { t, dayName, formatDate } = useI18n();
    const first = `${month}-01`;
    const lead = isoWeekdayOf(first) - 1;
    const dates = Array.from({ length: getDaysInMonth(parseISO(first)) }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);

    const marksOn = (date) => {
        const marks = rows.filter((row) => row.date === date).map((row) => ({ status: row.status, id: row.class?.id, name: row.class?.name }));
        if (date > today) {
            for (const cls of classes) {
                const joined = !cls.joinedAt || date >= cls.joinedAt.slice(0, 10);
                if (joined && cls.schedules.some((s) => s.day_of_week === isoWeekdayOf(date))) marks.push({ status: 'upcoming', id: cls.id, name: cls.name });
            }
        }
        return marks;
    };

    return (
        <div className="pfCalendar">
            <div className="pfCalHead" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <span key={day}>{dayName(day, 'short')}</span>
                ))}
            </div>
            <ol className="pfCalDays">
                {Array.from({ length: lead }, (_, i) => (
                    <li key={`blank-${i}`} className="isBlank" aria-hidden="true" />
                ))}
                {dates.map((date) => {
                    const marks = marksOn(date);
                    const tone = PRIORITY.find((status) => marks.some((mark) => mark.status === status));
                    const cellClass = ['pfCalDay', tone && `is-${tone}`, date === today && 'isToday'].filter(Boolean).join(' ');
                    return (
                        <li key={date} className={cellClass}>
                            <span className="pfCalNum" aria-hidden="true">
                                {Number(date.slice(8))}
                            </span>
                            {marks.length > 0 && (
                                <span className="pfCalMarks" aria-hidden="true">
                                    {marks.map((mark, index) => {
                                        const Icon = ICONS[mark.status];
                                        return (
                                            <i
                                                key={index}
                                                className={`is-${mark.status}`}
                                                style={{ '--hue': classHue(mark.id) }}
                                                title={`${mark.name} · ${t(LABELS[mark.status])}`}
                                            >
                                                {Icon && <Icon />}
                                            </i>
                                        );
                                    })}
                                </span>
                            )}
                            <span className="sr-only">
                                {formatDate(date, 'long')}
                                {marks.length > 0 && `: ${marks.map((mark) => `${mark.name} (${t(LABELS[mark.status])})`).join(', ')}`}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

export default MonthCalendar;
