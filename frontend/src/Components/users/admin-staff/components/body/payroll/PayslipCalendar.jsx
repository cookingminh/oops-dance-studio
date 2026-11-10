import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import CalendarView from '../../common/calendar/CalendarView';
import { useStudioClock } from '../../common/useStudioClock';
import { classColor } from '../../common/session-modal/sessionModel';
import { payslipItem } from './payrollShared';

// The payslip's sessions on a calendar of its month (the month can't change): each session in its
// class colour with its times and pay, or why it isn't counted. The legend repeats the payslip's
// lines per class (sessions, subtotal) and counts the sessions that aren't paid. A click opens the
// session (proofs, roll call).
//   sessions  instructor_attendance rows of the month    classes  { [classId]: class }
//   lines     payByClass() of the paid sessions          rateOf   session → pay
const PayslipCalendar = ({ month, today, profileId, sessions, classes, lines, rateOf, onOpen }) => {
    const { t, tn, monthName } = useI18n();
    const now = useStudioClock();
    const items = sessions.map((session) =>
        payslipItem(session, { cls: classes[session.class_id] ?? { ...session.class, id: session.class_id }, profileId, rate: rateOf(session), today, now, t })
    );
    const off = items.filter((item) => item.tone === 'muted').length;
    const later = items.filter((item) => item.tone === 'dashed').length;
    // Phones list one day under the grid: the next day with a session, else the first one.
    const days = items.map((item) => item.date).sort();
    const firstDay = days.find((day) => day >= today) ?? days[0];

    const legend = (
        <ul className="payLegend" aria-label={t('Paid sessions by class')}>
            {lines.map((line) => (
                <li key={line.id} style={{ '--pay-accent': classColor(line.id) }}>
                    <span className="payLegendDot" aria-hidden="true" />
                    <strong>{line.name}</strong>
                    <small>
                        {tn(line.n, '{count} session', '{count} sessions')} · {formatVnd(line.total)}
                    </small>
                </li>
            ))}
            {off > 0 && (
                <li className="isOff">
                    <span className="payLegendDot" aria-hidden="true" />
                    <strong>{t('Not counted')}</strong>
                    <small>{tn(off, '{count} session', '{count} sessions')}</small>
                </li>
            )}
            {later > 0 && (
                <li className="isLater">
                    <span className="payLegendDot" aria-hidden="true" />
                    <strong>{t('Not counted yet')}</strong>
                    <small>{tn(later, '{count} session', '{count} sessions')}</small>
                </li>
            )}
        </ul>
    );

    return (
        <CalendarView
            view="month"
            date={month}
            items={items}
            onSelect={(item) => onOpen(item.data)}
            today={today}
            fixed
            detailedChips
            initialDay={firstDay}
            toolbarExtra={legend}
            label={t('Sessions in {month}', { month: monthName(month, { withYear: true }) })}
            className="payCalendar"
        />
    );
};

export default PayslipCalendar;
