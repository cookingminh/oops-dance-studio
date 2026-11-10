import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chip } from '@nextui-org/react';
import { LuArrowLeft, LuChevronLeft, LuChevronRight, LuFlame, LuListChecks } from 'react-icons/lu';
import { addMonths, format, parseISO } from 'date-fns';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { useAsync } from '@/hooks/useAsync';
import AsyncState from '@/ui/feedback/AsyncState';
import { statusColorMap } from '../../../../../../Table/utils';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import Segmented from '../../../../../admin-staff/components/common/Segmented';
import { attendanceSummary, classHue } from '../../profileHelpers';
import { loadStudentClasses } from '../classes/classData';
import { ClassThumb } from '../classes/ClassParts';
import { RateRing } from '../classes/ClassProgress';
import { NoClasses } from '../classes/ClassView';
import MonthCalendar from './MonthCalendar';

const LABELS = { attend: 'Attended', absent: 'Absent', pending: 'Not marked' }; // English, translated where shown
const shiftMonth = (month, by) => format(addMonths(parseISO(`${month}-01`), by), 'yyyy-MM');

// The student's attendance across classes, a month at a time: a calendar, the month's numbers
// and every roll call of the month. (Each class's own attendance is also in My Classes.)
const MyAttendance = () => {
    const { user } = useAuth();
    const { t, tn, formatDate } = useI18n();
    const data = useAsync(() => loadStudentClasses(user.id), [user.id]);
    const [params, setParams] = useSearchParams();
    const [cursor, setCursor] = useState(null); // 'yyyy-MM'; null = this month

    const { today, classes = [], attendance = [] } = data.data ?? {};
    const wanted = Number(params.get('class'));
    const classId = classes.some((cls) => cls.id === wanted) ? wanted : 'all';
    const shownClasses = classId === 'all' ? classes : classes.filter((cls) => cls.id === classId);
    const rows = classId === 'all' ? attendance : attendance.filter((row) => row.class?.id === classId);

    const thisMonth = today?.slice(0, 7);
    const month = cursor ?? thisMonth;
    const firstMonth = [...rows.map((row) => row.date), ...shownClasses.map((cls) => cls.joinedAt?.slice(0, 10))].filter(Boolean).sort()[0]?.slice(0, 7) ?? thisMonth;
    const inMonth = month ? rows.filter((row) => row.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date)) : [];
    const summary = attendanceSummary(inMonth);
    const overall = attendanceSummary(attendance);
    const total = attendanceSummary(rows);

    const monthTitle = month ? formatDate(`${month}-01`, 'monthYear') : '';
    const pickClass = (key) => setParams(key === 'all' ? {} : { class: String(key) }, { replace: true });

    return (
        <SectionCard
            className="pfAttendanceCard"
            icon={LuListChecks}
            title={t('Your Attendance')}
            subtitle={data.data ? t('{attended} sessions attended · {absent} missed in total', { attended: overall.attended, absent: overall.absent }) : t('Loading…')}
            actions={
                month && (
                    <div className="pfMonthNav" role="group" aria-label={t('Month')}>
                        <button type="button" className="iconButton" onClick={() => setCursor(shiftMonth(month, -1))} disabled={month <= firstMonth} aria-label={t('Previous month')}>
                            <LuChevronLeft />
                        </button>
                        <strong aria-live="polite">{monthTitle}</strong>
                        <button type="button" className="iconButton" onClick={() => setCursor(shiftMonth(month, 1))} disabled={month >= thisMonth} aria-label={t('Next month')}>
                            <LuChevronRight />
                        </button>
                    </div>
                )
            }
        >
            <AsyncState state={data} isEmpty={false}>
                {classes.length === 0 && attendance.length === 0 ? (
                    <NoClasses />
                ) : (
                    <>
                        {classes.length > 1 && (
                            <Segmented
                                className="pfClassFilter"
                                label={t('Class')}
                                value={classId}
                                onChange={pickClass}
                                options={[
                                    { key: 'all', label: t('All classes') },
                                    ...classes.map((cls) => ({ key: cls.id, label: cls.name, color: `hsl(${classHue(cls.id)}, 62%, 48%)` })),
                                ]}
                            />
                        )}

                        <div className="pfMonthGrid">
                            {month && <MonthCalendar month={month} today={today} rows={rows} classes={shownClasses} />}

                            <aside className="pfMonthSide">
                                <div className="pfMonthSummary">
                                    <RateRing rate={summary.rate} size={104} />
                                    <ul className="pfLegend">
                                        {['attend', 'absent', 'pending'].map((status) => (
                                            <li key={status} className={`is-${status}`}>
                                                <span className="pfLegendKey" aria-hidden="true" />
                                                {t(LABELS[status])}
                                                <strong>{status === 'attend' ? summary.attended : status === 'absent' ? summary.absent : summary.pending}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <p className={`pfStreakNote${total.streak > 0 ? ' isOn' : ''}`}>
                                    <LuFlame aria-hidden="true" />
                                    {total.streak > 0
                                        ? tn(total.streak, 'You came to your last class. Keep it going!', 'You came to your last {count} classes in a row. Keep it going!')
                                        : t('Come to your next class to start a new streak.')}
                                </p>
                                {classId !== 'all' && (
                                    <Link to={`/profile/my-classes?class=${classId}`} className="pfMiniLink">
                                        <LuArrowLeft aria-hidden="true" /> {t('Back to the class')}
                                    </Link>
                                )}
                            </aside>
                        </div>

                        <section className="pfRollList" aria-label={t('Roll calls in {month}', { month: monthTitle })}>
                            <h3>{t('Roll calls in {month}', { month: monthTitle })}</h3>
                            {inMonth.length === 0 ? (
                                <p className="pfMuted">{t('No classes this month.')}</p>
                            ) : (
                                <ul>
                                    {inMonth.map((row) => (
                                        <li key={row.id}>
                                            <span className="pfRollDate">
                                                <strong>{format(parseISO(row.date), 'd')}</strong>
                                                <small>{formatDate(row.date, 'weekdayShort')}</small>
                                            </span>
                                            {row.class && <ClassThumb cls={row.class} />}
                                            <span className="pfRollText">
                                                <strong>{row.class?.name}</strong>
                                                {row.details && <span>{row.details}</span>}
                                            </span>
                                            <Chip size="sm" variant="flat" color={statusColorMap[row.status] ?? 'default'}>
                                                {t(LABELS[row.status] ?? row.status)}
                                            </Chip>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default MyAttendance;
