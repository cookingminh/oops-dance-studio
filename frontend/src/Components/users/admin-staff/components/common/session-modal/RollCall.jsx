import { useState } from 'react';
import { Avatar, Button } from '@nextui-org/react';
import { LuCheck, LuCheckCheck, LuListChecks, LuX } from 'react-icons/lu';
import { generateStudentAttendance, setStudentAttendanceStatus } from '@/services/attendance';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { personName, rollOf } from './sessionModel';

// One session's roll call: one tap per student (attended / absent). Rows keep their order (by
// name) so nothing jumps while you tap. `readOnly` for an ended class.
const RollCall = ({ cls, session, rows, today, readOnly, onChanged }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [busy, setBusy] = useState(null);
    const sorted = [...rows].sort((a, b) => personName(a.student).localeCompare(personName(b.student)));
    const { marked, total } = rollOf(rows);
    const attended = rows.filter((row) => row.status === 'attend').length;
    const cancelled = session.row?.status === 'cancelled';
    const percent = total ? Math.round((marked / total) * 100) : 0;

    const mark = async (row, status) => {
        if (row.status === status) return;
        setBusy(row.id);
        try {
            await setStudentAttendanceStatus(row.id, status);
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const markAll = async () => {
        setBusy('all');
        try {
            await Promise.all(rows.filter((row) => row.status === 'pending').map((row) => setStudentAttendanceStatus(row.id, 'attend')));
            toast.success(t('Everyone left in {name} is marked as attended.', { name: cls.name }));
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    const create = async () => {
        setBusy('create');
        try {
            const created = await generateStudentAttendance();
            toast.success(created > 0 ? t('Created {count} attendance records for today.', { count: created }) : 'Today’s records already exist.');
            onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(null);
        }
    };

    if (rows.length === 0) {
        let text = t('No roll call was taken.');
        if (cancelled) text = t('No roll call: the session was cancelled.');
        else if (session.date > today) text = t('The roll call opens on the day of the session.');
        else if (session.date === today) text = t('Today’s roll call hasn’t been created yet.');
        return (
            <div className="smRollEmpty">
                <LuListChecks aria-hidden="true" />
                <span>{text}</span>
                {session.date === today && !cancelled && !readOnly && (
                    <Button size="sm" variant="flat" isLoading={busy === 'create'} onPress={create}>
                        {t('Create today’s roll call')}
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="smRoll">
            <div className="smRollHead">
                <span>
                    {t('{done} of {total} marked', { done: marked, total })} · {t('{count} attended', { count: attended })}
                </span>
                {!readOnly && marked < total && (
                    <Button size="sm" variant="flat" color="success" startContent={<LuCheckCheck aria-hidden="true" />} isLoading={busy === 'all'} onPress={markAll}>
                        {t('Mark everyone left as attended')}
                    </Button>
                )}
            </div>
            <div className="smProgress" role="progressbar" aria-label={t('{name}: attendance marked', { name: cls.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <span style={{ width: `${percent}%` }} />
            </div>
            <ul className="smRoster">
                {sorted.map((row) => {
                    const name = personName(row.student) || t('Student');
                    const state = row.status === 'pending' ? t('Not marked') : t(row.status === 'attend' ? 'Attended' : 'Absent');
                    return (
                        <li key={row.id} className={`smRosterRow is-${row.status}`}>
                            <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(row.student?.avatar_path, row.student?.updated_at) ?? undefined} name={name} />
                            <span className="smRosterName">
                                <strong>{name}</strong>
                                {/* Read-only rows show the mark on the right; otherwise it's on the toggle. */}
                                <span>{row.student?.contact_number || (readOnly ? '' : state)}</span>
                            </span>
                            {readOnly ? (
                                <span className={`smMark is-${row.status}`}>{state}</span>
                            ) : (
                                <span className="smToggle" role="group" aria-label={t('{name}: attendance', { name })}>
                                    <button type="button" className="isAbsent" aria-pressed={row.status === 'absent'} aria-label={t('Mark absent')} disabled={busy === row.id} onClick={() => mark(row, 'absent')}>
                                        <LuX aria-hidden="true" /> <span>{t('Absent')}</span>
                                    </button>
                                    <button type="button" className="isAttend" aria-pressed={row.status === 'attend'} aria-label={t('Mark attended')} disabled={busy === row.id} onClick={() => mark(row, 'attend')}>
                                        <LuCheck aria-hidden="true" /> <span>{t('Attended')}</span>
                                    </button>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default RollCall;
