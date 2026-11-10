import { Avatar } from '@nextui-org/react';
import { LuUsers } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { avatarUrl } from '@/services/storage';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { attendanceSummary } from '../../profileHelpers';
import { RecentDots } from './ClassProgress';
import './routineCard.scss';

const nameOf = (student) => student.full_name || student.username;

// Instructor: who is in the class and how each student has been turning up (last 90 days). Someone
// joining later or leaving after a date (e.g. a class switch) says so next to their name.
export const ClassRoster = ({ cls, today }) => {
    const { t, formatDate } = useI18n();
    const byStudent = new Map();
    for (const row of cls.rollCalls) byStudent.set(row.student_id, [...(byStudent.get(row.student_id) ?? []), row]);

    return (
        <section className="pfBlock pfRoster" aria-label={t('Students')}>
            <header className="pfBlockHead">
                <h4>
                    <LuUsers aria-hidden="true" /> {t('Students')} <span className="pfCount">{cls.students.length}</span>
                </h4>
                {cls.students.length > 0 && <span>{t('Last 5 roll calls · rate over 90 days')}</span>}
            </header>
            {cls.students.length === 0 ? (
                <p className="pfMuted">{t('No students yet.')}</p>
            ) : (
                <ul className="pfRosterList">
                    {cls.students.map((student) => {
                        const summary = attendanceSummary(byStudent.get(student.id), 5);
                        const phone = student.contact_number?.trim();
                        let when = null;
                        if (today && student.joinedAt > today) when = t('Joins {date}', { date: formatDate(student.joinedAt, 'short') });
                        else if (student.leavesAfter) when = t('Last day {date}', { date: formatDate(student.leavesAfter, 'short') });
                        return (
                            <li key={student.id} className={when ? 'isChanging' : undefined}>
                                <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(student.avatar_path, student.updated_at) ?? undefined} name={nameOf(student)} />
                                <span className="pfRosterName">
                                    <strong>
                                        {nameOf(student)}
                                        {when && <span className="pfRosterWhen">{when}</span>}
                                    </strong>
                                    {phone ? (
                                        <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
                                    ) : (
                                        <small>{student.email}</small>
                                    )}
                                </span>
                                <RecentDots rows={summary.recent} size="sm" />
                                <span className={`pfRate${summary.rate !== null && summary.rate < 60 ? ' isLow' : ''}`}>
                                    {summary.rate === null ? '—' : `${summary.rate}%`}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

// A row of overlapping avatars for small spaces.
export const AvatarStack = ({ students, max = 5 }) => {
    const { t } = useI18n();
    const shown = students.slice(0, max);
    return (
        <span className="pfAvatarStack" role="group" aria-label={t('{count} students', { count: students.length })}>
            {shown.map((student) => (
                <Avatar
                    key={student.id}
                    {...AVATAR_DEFAULTS}
                    size="sm"
                    src={avatarUrl(student.avatar_path, student.updated_at) ?? undefined}
                    name={nameOf(student)}
                    title={nameOf(student)}
                />
            ))}
            {students.length > max && <span className="pfAvatarMore">+{students.length - max}</span>}
        </span>
    );
};
