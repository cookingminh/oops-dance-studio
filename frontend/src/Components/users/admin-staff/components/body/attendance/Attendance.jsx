import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { updateInstructorAttendance } from '@/services/attendance';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { useI18n } from '@/i18n/i18nContext';
import { useStaffTasks } from '../../../tasks/staffTasks';
import SectionCard from '../../common/SectionCard';
import SessionModal from '../../common/session-modal/SessionModal';
import { ProofDialog } from '../../common/session-modal/SessionParts';
import RescheduleDialog from '../../common/session-changes/RescheduleDialog';
import { isReadOnly, rangeSessions, sessionKey } from '../../common/session-modal/sessionModel';
import { loadBase, loadToday } from './attendanceData';
import TodayBoard from './components/TodayBoard';
import ReviewQueue from './components/ReviewQueue';
import SessionsCalendar from './components/SessionsCalendar';
import AttendanceChart from './components/AttendanceChart';
import ClassMembersLinks from './components/ClassMembersLinks';
import CloseDayDialog from './components/CloseDayDialog';
import './attendance.scss';

// /admin/attendance — students' roll calls and instructors' check-ins in one place, in the order
// staff deal with them: today (quick actions), earlier sessions nobody closed, every session on a
// calendar, sessions per instructor, and links to each class's members. Every session opens the
// same modal as on the class page. ?class=<id>&day=yyyy-MM-dd opens one session (from a to-do);
// ?day=yyyy-MM-dd alone opens the calendar on that day (a day the studio was closed, from the log).
// Today's header also closes the studio for a day (storm, power cut).
const Attendance = () => {
    const { t } = useI18n();
    const toast = useToast();
    const { refresh: refreshTasks } = useStaffTasks();
    const [params, setParams] = useSearchParams();
    const base = useAsync(loadBase, []);
    const [version, setVersion] = useState(0);
    const todayState = useAsync(() => (base.data ? loadToday(base.data.today, base.data.classes) : Promise.resolve(undefined)), [base.data, version]);
    const [modal, setModal] = useState(null); // { session, focus }
    const [proof, setProof] = useState(null);
    const [busyKey, setBusyKey] = useState(null);
    const [moving, setMoving] = useState(null); // a session of today's board to call off / move
    const [closingDay, setClosingDay] = useState(false);

    const today = base.data?.today;
    const classes = base.data?.classes ?? [];
    const readOnlyOf = (cls) => isReadOnly(cls, today);

    const changed = () => {
        setVersion((value) => value + 1);
        refreshTasks();
    };

    // A deep link opens its session once the classes are in (state adjusted during render).
    const linkKey = params.get('class') && params.get('day') ? sessionKey(params.get('class'), params.get('day')) : null;
    const linkDay = !params.get('class') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') ?? '') ? params.get('day') : null;
    const [seenLink, setSeenLink] = useState(null);
    if (linkKey && base.data && seenLink !== linkKey) {
        setSeenLink(linkKey);
        const cls = classes.find((item) => String(item.id) === params.get('class'));
        const day = params.get('day');
        if (cls) setModal({ session: rangeSessions(cls, day, day)[0] ?? { key: linkKey, cls, date: day, row: null, extra: false, start: '', end: '' } });
    }

    const closeModal = () => {
        setModal(null);
        if (linkKey) setParams({}, { replace: true });
    };

    const review = async (session, fields, message) => {
        setBusyKey(session.key);
        try {
            await updateInstructorAttendance(session.row.id, fields);
            toast.success(message);
            changed();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusyKey(null);
        }
    };

    if (!base.data) {
        return (
            <SectionCard title={t('Attendance')}>
                <AsyncState state={base} isEmpty={false}>
                    {null}
                </AsyncState>
            </SectionCard>
        );
    }

    const reviewSessions = todayState.data?.review ?? [];

    return (
        <>
            <TodayBoard
                state={todayState}
                today={today}
                isReadOnly={readOnlyOf}
                onOpen={(session, focus) => setModal({ session, focus })}
                onChanged={changed}
                onViewProof={setProof}
                onReschedule={setMoving}
                onCloseDay={() => setClosingDay(true)}
            />
            {reviewSessions.length > 0 && (
                <ReviewQueue
                    sessions={reviewSessions}
                    busyKey={busyKey}
                    onOpen={(session) => setModal({ session })}
                    onApprove={(session) => review(session, { status: 'completed' }, 'Marked as completed.')}
                    onCancel={(session) =>
                        window.confirm(t('Cancel this session? It won’t count for the routine, which then ends one session later.')) &&
                        review(session, { status: 'cancelled' }, 'Session cancelled.')
                    }
                />
            )}
            <SessionsCalendar key={linkDay ?? 'today'} today={today} startDate={linkDay} classes={classes} version={version} onOpen={(session) => setModal({ session })} />
            <AttendanceChart />
            <ClassMembersLinks classes={classes} today={today} />

            {modal && (
                <SessionModal
                    key={modal.session.key}
                    session={modal.session}
                    today={today}
                    instructors={base.data.instructors}
                    readOnly={readOnlyOf(modal.session.cls)}
                    focus={modal.focus}
                    classLink
                    onClose={closeModal}
                    onChanged={changed}
                />
            )}
            {proof && <ProofDialog proof={proof} onClose={() => setProof(null)} />}
            {moving && (
                <RescheduleDialog
                    session={moving}
                    today={today}
                    onClose={() => setMoving(null)}
                    onDone={() => {
                        setMoving(null);
                        changed();
                    }}
                />
            )}
            {closingDay && <CloseDayDialog today={today} classes={classes} onClose={() => setClosingDay(false)} onChanged={changed} />}
        </>
    );
};

export default Attendance;
