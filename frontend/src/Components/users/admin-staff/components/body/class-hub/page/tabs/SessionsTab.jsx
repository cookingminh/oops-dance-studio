import { useState } from 'react';
import { Button } from '@nextui-org/react';
import { LuCalendarPlus, LuCalendarRange } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { generateInstructorAttendance } from '@/services/attendance';
import { listRollMarks, listSessionRows } from '@/services/attendanceHub';
import { toIsoDate } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import SectionCard from '../../../../common/SectionCard';
import { useStudioClock } from '../../../../common/useStudioClock';
import CalendarView from '../../../../common/calendar/CalendarView';
import { calendarRange } from '../../../../common/calendar/calendarModel';
import SessionModal from '../../../../common/session-modal/SessionModal';
import SessionLegend from '../../../../common/session-modal/SessionLegend';
import { calendarItem, rangeSessions, sessionKey } from '../../../../common/session-modal/sessionModel';
import { readView, rememberView } from '../../../../common/session-modal/viewPreference';
import { changeDay, reasonText } from '../../../../common/session-changes/changeText';
import MakeUpDialog from '../../../class-manager/routines/MakeUpDialog';
import { sessionTimes, shiftDay } from '../../hubModel';
import ClassAttendanceHistory from '../sessions/ClassAttendanceHistory';
import '../sessions/sessions.scss';

// Sessions & attendance: the class's sessions on a calendar (month or week; the choice is
// remembered), coloured by how far each got. Clicking one opens the session modal: instructor and
// substitute, check-in proofs, approve / cancel / reopen, note and the students' roll call.
// ?day=yyyy-MM-dd opens that day's session (from "Take today's roll call" or a to-do).
const SessionsTab = ({ ctx }) => {
    const { cls, today, badge, params, setTab, version, changed, instructors } = ctx;
    const i18n = useI18n();
    const { t, tn } = i18n;
    const toast = useToast();
    const now = useStudioClock();
    const readOnly = badge.phase === 'ended';
    const day = params.get('day');
    const home = (readOnly ? cls.ended_on : cls.starts_on > today ? cls.starts_on : today) ?? today;

    const [view, setView] = useState(() => readView('sessions', 'month'));
    const [date, setDate] = useState(day ?? home);
    const [openDay, setOpenDay] = useState(day);
    const [seenDay, setSeenDay] = useState(day);
    // A new ?day= (the header button while this tab is open) jumps to that day (state adjusted in render).
    if (day !== seenDay) {
        setSeenDay(day);
        if (day) {
            setDate(day);
            setOpenDay(day);
        }
    }

    const [local, setLocal] = useState(0);
    const [dialog, setDialog] = useState(null); // 'makeUp'
    const [generating, setGenerating] = useState(false);
    const { from, until } = calendarRange(view, date);
    const data = useAsync(
        () => Promise.all([listSessionRows({ classId: cls.id, from, until }), listRollMarks({ classId: cls.id, from, until })]).then(([rows, marks]) => ({ rows, marks })),
        [cls.id, from, until, version, local]
    );

    const rows = data.data?.rows ?? [];
    const marksBy = new Map();
    for (const mark of data.data?.marks ?? []) {
        if (!marksBy.has(mark.date)) marksBy.set(mark.date, []);
        marksBy.get(mark.date).push(mark);
    }
    const sessions = rangeSessions(cls, from, until, rows);
    const reason = (text) => reasonText(text, t);
    const dayOf = (value) => changeDay(value, i18n, { short: true });
    const items = sessions.map((session) => calendarItem(session, { today, now, roll: marksBy.get(session.date), t, byState: true, reason, day: dayOf }));

    // Counts for the month shown (the month view also shows a few days of its neighbours).
    const counted = view === 'month' ? sessions.filter((session) => session.date.slice(0, 7) === date.slice(0, 7)) : sessions;
    const done = counted.filter((session) => session.row?.status === 'completed').length;
    const cancelledCount = counted.filter((session) => session.row?.status === 'cancelled').length;
    // This week's sessions without a check-in record yet (the weekly job creates them).
    const weekEnd = shiftDay(today, 7 - (new Date(`${today}T00:00:00`).getDay() || 7));
    const missing = !readOnly && sessions.some((session) => !session.row && session.date >= today && session.date <= weekEnd);

    // The opened session: from the calendar, or built for a ?day= outside the loaded range.
    const opened = openDay
        ? sessions.find((session) => session.date === openDay) ?? { key: sessionKey(cls.id, openDay), cls, date: openDay, row: null, extra: false, ...sessionTimes(cls, openDay, null) }
        : null;

    const reload = () => {
        setLocal((value) => value + 1);
        changed();
    };

    const closeModal = () => {
        setOpenDay(null);
        // Drop ?day= so a reload doesn't open the session again.
        if (params.get('day')) setTab('sessions');
    };

    const generate = async () => {
        setGenerating(true);
        try {
            const created = await generateInstructorAttendance();
            toast.success(created > 0 ? t('Created {count} records for this week.', { count: created }) : 'This week’s records already exist.');
            reload();
        } catch (error) {
            toast.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const changeView = (next) => {
        setView(next);
        rememberView('sessions', next);
    };

    const subtitle = data.data
        ? [
            tn(counted.length, '{count} session', '{count} sessions'),
            t('{count} done', { count: done }),
            cancelledCount ? t('{count} cancelled', { count: cancelledCount }) : null,
        ].filter(Boolean).join(' · ')
        : t('Loading…');

    return (
        <>
            <SectionCard
                className="hubSessionsCard"
                icon={LuCalendarRange}
                title={t('Sessions & attendance')}
                subtitle={subtitle}
                actions={
                    !readOnly && (
                        <>
                            {missing && (
                                <Button variant="flat" isLoading={generating} onPress={generate}>
                                    {t('Create this week’s records')}
                                </Button>
                            )}
                            <Button color="danger" variant="flat" startContent={<LuCalendarPlus aria-hidden="true" />} onPress={() => setDialog('makeUp')}>
                                {t('Add a make-up session')}
                            </Button>
                        </>
                    )
                }
            >
                <CalendarView
                    view={view}
                    onViewChange={changeView}
                    date={date}
                    onDateChange={(next) => setDate(toIsoDate(next))}
                    items={items}
                    onSelect={(item) => setOpenDay(item.data.date)}
                    today={today}
                    loading={data.loading}
                    label={t('Sessions of {name}', { name: cls.name })}
                    className="sessionCalendar"
                />
                <SessionLegend byState />
                {data.error && <p className="hubHint">{t(data.error.message)}</p>}
            </SectionCard>

            <ClassAttendanceHistory cls={cls} today={today} version={`${version}-${local}`} />

            {opened && !dialog && (
                <SessionModal
                    key={opened.key}
                    session={opened}
                    today={today}
                    instructors={instructors}
                    readOnly={readOnly}
                    focus={day ? 'roll' : undefined}
                    onClose={closeModal}
                    onChanged={reload}
                />
            )}
            {dialog === 'makeUp' && (
                <MakeUpDialog
                    cls={cls}
                    today={today}
                    makeUps={rows.filter((row) => row.is_extra && row.status !== 'cancelled')}
                    onClose={() => setDialog(null)}
                    onAdded={() => {
                        setDialog(null);
                        setOpenDay(null);
                        reload();
                    }}
                />
            )}
        </>
    );
};

export default SessionsTab;
