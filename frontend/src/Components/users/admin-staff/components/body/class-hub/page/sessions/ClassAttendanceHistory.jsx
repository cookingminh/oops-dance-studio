import { useState } from 'react';
import { Avatar, Tooltip } from '@nextui-org/react';
import { LuCheck, LuHistory, LuMinus, LuX } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { listClassAttendanceHistory } from '@/services/attendance';
import { avatarUrl } from '@/services/storage';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import AsyncState from '@/ui/feedback/AsyncState';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../../common/SectionCard';

const PAGE = 8; // sessions shown at a time

// Labels are English (translated where shown).
const MARKS = {
    attend: { icon: LuCheck, label: 'Attended' },
    absent: { icon: LuX, label: 'Absent' },
    pending: { icon: LuMinus, label: 'Not marked' },
};

// Past roll calls of one class: students × sessions, newest session on the right, with each
// student's attendance rate over every marked session. `version` reloads it after a roll call.
const ClassAttendanceHistory = ({ cls, today, version }) => {
    const { t, formatDate } = useI18n();
    const history = useAsync(() => listClassAttendanceHistory(cls.id, { until: today }), [cls.id, today, version]);
    const [offset, setOffset] = useState(0); // sessions skipped from the newest

    const rows = history.data ?? [];
    const dates = [...new Set(rows.map((row) => row.date))]; // newest first
    const shown = dates.slice(offset, offset + PAGE).reverse();
    const status = new Map(rows.map((row) => [`${row.student_id}|${row.date}`, row.status]));

    // Current members first, then anyone who has since left the class.
    const members = (cls.students ?? []).map(({ student }) => student);
    const memberIds = new Set(members.map((student) => student.id));
    const formerIds = [...new Set(rows.map((row) => row.student_id))].filter((id) => !memberIds.has(id));

    const rateOf = (studentId) => {
        const marked = rows.filter((row) => row.student_id === studentId && row.status !== 'pending');
        if (marked.length === 0) return null;
        return Math.round((marked.filter((row) => row.status === 'attend').length / marked.length) * 100);
    };

    const renderRow = (id, person) => {
        const name = person?.full_name || person?.username || t('Former student');
        const rate = rateOf(id);
        return (
            <tr key={id}>
                <th scope="row">
                    <span className="historyStudent">
                        <Avatar {...AVATAR_DEFAULTS} size="sm" src={person ? avatarUrl(person.avatar_path, person.updated_at) ?? undefined : undefined} name={name} />
                        <span>{name}</span>
                    </span>
                </th>
                {shown.map((date) => {
                    const value = status.get(`${id}|${date}`);
                    if (!value) return <td key={date} className="historyCell isNone" aria-label={t('Not enrolled')} />;
                    const { icon: Icon } = MARKS[value];
                    const label = t(MARKS[value].label);
                    return (
                        <td key={date} className={`historyCell is-${value}`}>
                            <Tooltip content={`${label} · ${formatDate(date, 'short')}`}>
                                <span className="historyMark" aria-label={label}>
                                    <Icon aria-hidden="true" />
                                </span>
                            </Tooltip>
                        </td>
                    );
                })}
                <td className="historyRate">
                    {rate === null ? (
                        <span className="isMuted">—</span>
                    ) : (
                        <span className={`rateChip${rate >= 80 ? ' isGood' : rate < 50 ? ' isLow' : ''}`}>{rate}%</span>
                    )}
                </td>
            </tr>
        );
    };

    const pager =
        dates.length > 0 ? (
            <span className="historyPager">
                <button type="button" onClick={() => setOffset((value) => value + PAGE)} disabled={offset + PAGE >= dates.length}>
                    ‹ {t('Older')}
                </button>
                <span>{t('{from}–{to} of {total} sessions', { from: dates.length - offset - shown.length + 1, to: dates.length - offset, total: dates.length })}</span>
                <button type="button" onClick={() => setOffset((value) => Math.max(0, value - PAGE))} disabled={offset === 0}>
                    {t('Newer')} ›
                </button>
            </span>
        ) : null;

    return (
        <SectionCard
            className="hubHistoryCard"
            icon={LuHistory}
            title={t('Attendance history')}
            subtitle={t('Every roll call of this class, student by student')}
            actions={pager}
            aria-label={t('{name} attendance history', { name: cls.name })}
        >
            <AsyncState state={history} emptyText="No roll calls yet for this class.">
                <div className="historyScroll">
                    <table className="historyTable">
                        <thead>
                            <tr>
                                <th scope="col">{t('Student')}</th>
                                {shown.map((date) => (
                                    <th scope="col" key={date}>
                                        <span>{formatDate(date, 'weekdayShort')}</span>
                                        <strong>{format(parseISO(date), 'd/M')}</strong>
                                    </th>
                                ))}
                                <th scope="col">{t('Rate')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((student) => renderRow(student.id, student))}
                            {formerIds.map((id) => renderRow(id, null))}
                        </tbody>
                    </table>
                </div>
            </AsyncState>
        </SectionCard>
    );
};

export default ClassAttendanceHistory;
