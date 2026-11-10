import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '@/hooks/useAsync';
import { updateInstructorAttendance } from '@/services/attendance';
import { listMakeUpSessions } from '@/services/sessions';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { useI18n } from '@/i18n/i18nContext';
import { useStaffTasks } from '../../../tasks/staffTasks';
import SectionCard from '../../common/SectionCard';
import SessionModal from '../../common/session-modal/SessionModal';
import { ProofDialog } from '../../common/session-modal/SessionParts';
import { isReadOnly, rangeSessions, sessionKey } from '../../common/session-modal/sessionModel';
import MakeUpDialog from '../class-manager/routines/MakeUpDialog';
import { loadBase, loadToday } from './attendanceData';
import TodayBoard from './components/TodayBoard';
import ReviewQueue from './components/ReviewQueue';
import SessionsCalendar from './components/SessionsCalendar';
import AttendanceChart from './components/AttendanceChart';
import ClassMembersLinks from './components/ClassMembersLinks';
import './attendance.scss';

// /admin/attendance — students' roll calls and instructors' check-ins in one place, in the order
// staff deal with them: today (quick actions), earlier sessions nobody closed, every session on a
// calendar, sessions per instructor, and links to each class's members. Every session opens the
// same modal as on the class page. ?class=<id>&day=yyyy-MM-dd opens one session (from a to-do).
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
    const [makeUpFor, setMakeUpFor] = useState(null); // class
    const [busyKey, setBusyKey] = useState(null);

    const today = base.data?.today;
    const classes = base.data?.classes ?? [];
    const readOnlyOf = (cls) => isReadOnly(cls, today);

    const changed = () => {
        setVersion((value) => value + 1);
        refreshTasks();
    };

    // A deep link opens its session once the classes are in (state adjusted during render).
    const linkKey = params.get('class') && params.get('day') ? sessionKey(params.get('class'), params.get('day')) : null;
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
            <SessionsCalendar today={today} classes={classes} version={version} onOpen={(session) => setModal({ session })} />
            <AttendanceChart />
            <ClassMembersLinks classes={classes} today={today} />

            {modal && !makeUpFor && (
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
                    onMakeUp={() => setMakeUpFor(modal.session.cls)}
                />
            )}
            {makeUpFor && (
                <MakeUpFor
                    cls={makeUpFor}
                    today={today}
                    onClose={() => setMakeUpFor(null)}
                    onAdded={() => {
                        setMakeUpFor(null);
                        setModal(null);
                        changed();
                    }}
                />
            )}
            {proof && <ProofDialog proof={proof} onClose={() => setProof(null)} />}
        </>
    );
};

// "Add a make-up session" from a cancelled session: the dialog needs the class's other make-ups.
const MakeUpFor = ({ cls, today, onClose, onAdded }) => {
    const makeUps = useAsync(() => listMakeUpSessions([cls.id], { from: today }), [cls.id, today]);
    if (!makeUps.data) return null;
    return <MakeUpDialog cls={cls} today={today} makeUps={makeUps.data} onClose={onClose} onAdded={onAdded} />;
};

export default Attendance;
