import { Link } from 'react-router-dom';
import { Chip, Spinner } from '@nextui-org/react';
import { LuArrowUpRight, LuWallet } from 'react-icons/lu';
import { formatTimeRange, formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { ErrorMessage } from '@/ui/feedback/AsyncState';
import { statusColorMap } from '../../../../../../../Table/utils';

const OPEN_SESSION = ['pending', 'waiting', 'in_progress'];

const SectionHead = ({ id, title, count, to, linkLabel }) => (
    <div className="sectionHead">
        <h3 id={id}>
            {title} {count !== undefined && <span className="segCount">{count}</span>}
        </h3>
        {to && (
            <Link className="sectionLink" to={to}>
                {linkLabel} <LuArrowUpRight aria-hidden="true" />
            </Link>
        )}
    </div>
);

const MiniStats = ({ items }) => (
    <dl className="miniStats">
        {items.map((item) => (
            <div key={item.label} className={item.tone ? `is-${item.tone}` : undefined}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
            </div>
        ))}
    </dl>
);

// What the person has done: roll calls (students), sessions this month and pay (instructors, staff,
// admins) and their latest room bookings.
const ActivitySection = ({ person, activity }) => {
    const { t, tn, formatDate } = useI18n();

    if (activity.error) return <ErrorMessage error={activity.error} onRetry={activity.reload} />;
    if (!activity.data) {
        return (
            <div className="sheetLoading">
                <Spinner size="sm" color="danger" />
                <span>{t('Loading activity…')}</span>
            </div>
        );
    }

    const { bookings, bookingCount, marks, monthSessions, pay } = activity.data;
    const isLearner = person.role === 'guest';
    const isInstructor = person.role === 'instructor';

    // Roll calls: attended / absent / attendance rate.
    const attended = marks.filter((m) => m.status === 'attend');
    const absent = marks.filter((m) => m.status === 'absent').length;
    const rate = attended.length + absent ? Math.round((attended.length / (attended.length + absent)) * 100) : null;

    const done = monthSessions.filter((s) => s.status === 'completed').length;
    const open = monthSessions.filter((s) => OPEN_SESSION.includes(s.status)).length;
    const cancelled = monthSessions.filter((s) => s.status === 'cancelled').length;

    return (
        <>
            {(isLearner || marks.length > 0) && person.enrolments.length + marks.length > 0 && (
                <section className="sheetSection" aria-labelledby="sheet-attendance">
                    <SectionHead id="sheet-attendance" title={t('Attendance')} />
                    {marks.length === 0 ? (
                        <p className="sectionEmpty">{t('No roll calls yet.')}</p>
                    ) : (
                        <>
                            <MiniStats
                                items={[
                                    { label: t('Attended'), value: attended.length, tone: 'good' },
                                    { label: t('Absent'), value: absent, tone: 'bad' },
                                    { label: t('Attendance rate'), value: rate === null ? '—' : `${rate}%` },
                                ]}
                            />
                            <p className="sectionNote">
                                {attended.length ? t('Last came on {date}.', { date: formatDate(attended[0].date, 'long') }) : t('Hasn’t attended a class yet.')}
                            </p>
                        </>
                    )}
                </section>
            )}

            {(isInstructor || monthSessions.length > 0) && (
                <section className="sheetSection" aria-labelledby="sheet-sessions">
                    <SectionHead id="sheet-sessions" title={t('Sessions this month')} count={monthSessions.length} to="/admin/attendance" linkLabel={t('Open attendance')} />
                    {monthSessions.length === 0 ? (
                        <p className="sectionEmpty">{t('No sessions this month.')}</p>
                    ) : (
                        <MiniStats
                            items={[
                                { label: t('Done'), value: done, tone: 'good' },
                                { label: t('Still open'), value: open },
                                { label: t('Cancelled'), value: cancelled, tone: 'bad' },
                            ]}
                        />
                    )}
                </section>
            )}

            {pay && (
                <section className="sheetSection" aria-labelledby="sheet-pay">
                    <SectionHead id="sheet-pay" title={t('Pay')} to="/admin/payroll" linkLabel={t('Open Payroll')} />
                    <div className="payLine">
                        <span className="payLineIcon" aria-hidden="true">
                            <LuWallet />
                        </span>
                        {isInstructor ? (
                            <p>
                                <strong>{t('{amount} per completed session', { amount: formatVnd(pay.defaultRate) })}</strong>
                                <span>{t('The studio’s default rate. Classes with their own rate show it above.')}</span>
                            </p>
                        ) : pay.salary ? (
                            <p>
                                <strong>{t('{amount} a month', { amount: formatVnd(pay.salary) })}</strong>
                                <span>{t('Monthly salary, paid through Payroll.')}</span>
                            </p>
                        ) : (
                            <p>
                                <strong>{t('No monthly salary set')}</strong>
                                <span>{t('Set one under Payroll → Rates & salaries if they are paid.')}</span>
                            </p>
                        )}
                    </div>
                </section>
            )}

            {(isLearner || bookingCount > 0) && (
                <section className="sheetSection" aria-labelledby="sheet-bookings">
                    <SectionHead id="sheet-bookings" title={t('Bookings')} count={bookingCount} to={bookingCount ? '/admin/bookings' : undefined} linkLabel={t('Open Bookings')} />
                    {bookings.length === 0 ? (
                        <p className="sectionEmpty">{t('No room bookings yet.')}</p>
                    ) : (
                        <>
                            <ul className="bookingLines">
                                {bookings.map((booking) => (
                                    <li key={booking.id}>
                                        <span className="bookingWhen">
                                            <strong>{formatDate(booking.date, 'short')}</strong>
                                            <small>
                                                {formatTimeRange(booking.start_time, booking.end_time)} · {booking.room?.name}
                                            </small>
                                        </span>
                                        <Chip size="sm" variant="flat" color={statusColorMap[booking.status] ?? 'default'}>
                                            {t(booking.status)}
                                        </Chip>
                                    </li>
                                ))}
                            </ul>
                            {bookingCount > bookings.length && (
                                <p className="sectionNote">{tn(bookingCount, '{count} booking in total', '{count} bookings in total')}</p>
                            )}
                        </>
                    )}
                </section>
            )}
        </>
    );
};

export default ActivitySection;
