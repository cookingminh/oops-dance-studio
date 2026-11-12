import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { deleteClass, getClass, listLessonProgress, reopenClass } from '@/services/classes';
import { listGuests, listInstructors } from '@/services/users';
import { listRooms } from '@/services/rooms';
import { listVenues } from '@/services/venues';
import { getStudioToday } from '@/services/studio';
import { isoWeekdayOf } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState from '@/ui/feedback/AsyncState';
import LinkButton from '@/ui/LinkButton';
import SectionCard from '../../../common/SectionCard';
import { useStaffTasks } from '../../../../tasks/staffTasks';
import ClassForm from '../../class-manager/components/classes/ClassForm';
import ChangeClassImageForm from '../../class-manager/components/classes/ChangeClassImageForm';
import { getClassHistory } from '../hubQueries';
import { HUB_BASE, TABS, phaseBadge } from '../hubModel';
import ClassHeader from './ClassHeader';
import EnrolDialog from './EnrolDialog';
import OverviewTab from './tabs/OverviewTab';
import StudentsTab from './tabs/StudentsTab';
import SessionsTab from './tabs/SessionsTab';
import TuitionTab from './tabs/TuitionTab';
import RoutinesTab from './tabs/RoutinesTab';
import MoneyTab from './tabs/MoneyTab';
import SetupTab from './tabs/SetupTab';

const PANELS = {
    overview: OverviewTab,
    students: StudentsTab,
    sessions: SessionsTab,
    tuition: TuitionTab,
    routines: RoutinesTab,
    money: MoneyTab,
    setup: SetupTab,
};

// The tab's cards (SectionCard: fadeUp) come in one after another; leaving is a quick fade.
const PANEL_MOTION = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.2, staggerChildren: 0.06 } },
    exit: { opacity: 0, transition: { duration: 0.12 } },
};

async function loadPage(id) {
    const [cls, today] = await Promise.all([getClass(id), getStudioToday()]);
    return { cls, today };
}

// /admin/classes/:id — one class with everything about it: a sticky header and tabs kept in the
// URL (?tab=). Tabs load their own data; `version` tells them to reload after a change elsewhere.
const ClassPage = () => {
    const { id } = useParams();
    const classId = Number(id);
    const { t } = useI18n();
    const toast = useToast();
    const navigate = useNavigate();
    const { role } = useAuth();
    const isAdmin = role === ROLES.admin;
    const { refresh: refreshTasks } = useStaffTasks();
    const [params, setParams] = useSearchParams();

    const page = useAsync(() => loadPage(classId), [classId]);
    const progress = useAsync(() => listLessonProgress([classId]).catch(() => []), [classId]);
    const history = useAsync(() => getClassHistory(classId), [classId]);
    const instructors = useAsync(listInstructors, []);
    const rooms = useAsync(listRooms, []);
    const venues = useAsync(listVenues, []);
    const [dialog, setDialog] = useState(null); // 'enrol' | 'edit' | 'image'
    const guests = useAsync(() => (dialog === 'enrol' ? listGuests() : Promise.resolve(undefined)), [dialog === 'enrol']);
    const [version, setVersion] = useState(0);

    const tabs = useMemo(() => TABS.filter((tab) => isAdmin || !tab.adminOnly), [isAdmin]);
    const asked = params.get('tab');
    const tab = tabs.some((item) => item.key === asked) ? asked : 'overview';

    // ?enrol=1 (from the "New class" wizard) opens "Add student" once.
    const wantsEnrol = params.get('enrol') === '1';
    useEffect(() => {
        if (!wantsEnrol) return;
        setDialog('enrol');
        setParams((old) => {
            const next = new URLSearchParams(old);
            next.delete('enrol');
            return next;
        }, { replace: true });
    }, [wantsEnrol, setParams]);

    const setTab = (key, extra = {}) =>
        setParams(() => {
            const next = new URLSearchParams({ tab: key });
            for (const [name, value] of Object.entries(extra)) next.set(name, value);
            return next;
        });

    const changed = () => {
        page.reload();
        progress.reload();
        history.reload();
        refreshTasks();
        setVersion((value) => value + 1);
    };

    const data = page.data;
    const cls = data?.cls;
    const today = data?.today;
    const badge = cls ? phaseBadge(cls, today) : null;
    const meetsToday = Boolean(cls && today && (cls.schedules ?? []).some((slot) => slot.day_of_week === isoWeekdayOf(today)));
    const noHistory = history.data && !history.data.sessions && !history.data.marks && !history.data.payments;

    const reopen = async () => {
        if (!window.confirm(t('Reopen {name}? It runs again and its weekly sessions come back where the room is still free.', { name: cls.name }))) return;
        try {
            const result = await reopenClass(cls.id);
            toast.success(
                result?.skipped
                    ? t('{name} reopened: {restored} weekly sessions back, {skipped} skipped because the room is taken.', { name: cls.name, restored: result.restored, skipped: result.skipped })
                    : t('{name} is running again.', { name: cls.name })
            );
            changed();
        } catch (error) {
            toast.error(error);
        }
    };

    const remove = async () => {
        if (!window.confirm(t('Delete “{name}”? Its schedules, lessons, enrolments and attendance records are deleted too.', { name: cls.name }))) return;
        try {
            await deleteClass(cls);
            toast.success('Class deleted.');
            refreshTasks();
            navigate(HUB_BASE);
        } catch (error) {
            toast.error(error);
            history.reload();
        }
    };

    if (page.error || (page.loading && !data)) {
        return (
            <SectionCard title={page.error ? t('This class can’t be opened') : undefined}>
                <AsyncState state={page} isEmpty={false}>
                    {null}
                </AsyncState>
                {page.error && (
                    <LinkButton to={HUB_BASE} variant="flat">
                        {t('All classes')}
                    </LinkButton>
                )}
            </SectionCard>
        );
    }

    const Panel = PANELS[tab];
    const ctx = {
        cls,
        today,
        badge,
        isAdmin,
        version,
        changed,
        progress: progress.data ?? [],
        history: history.data,
        instructors: instructors.data ?? [],
        rooms: rooms.data ?? [],
        venues: venues.data ?? [],
        params,
        setTab,
        openEnrol: () => setDialog('enrol'),
        openImage: () => setDialog('image'),
        reopen,
        remove,
        canDelete: Boolean(noHistory),
    };

    return (
        <>
            <ClassHeader
                cls={cls}
                badge={badge}
                tabs={tabs.map((item) => (item.key === 'students' ? { ...item, count: cls.students?.length } : item))}
                tab={tab}
                onTab={(key) => setTab(key)}
                meetsToday={meetsToday}
                canDelete={Boolean(noHistory)}
                actions={{
                    rollCall: () => setTab('sessions', { day: today }),
                    enrol: () => setDialog('enrol'),
                    edit: () => setDialog('edit'),
                    image: () => setDialog('image'),
                    end: () => setTab('setup', { end: '1' }),
                    reopen,
                    remove,
                }}
            />
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={tab}
                    id="hub-panel"
                    role="tabpanel"
                    aria-labelledby={`hub-tab-${tab}`}
                    className="hubPanel"
                    variants={PANEL_MOTION}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                >
                    <Panel ctx={ctx} />
                </motion.div>
            </AnimatePresence>

            {dialog === 'enrol' && guests.data && (
                <EnrolDialog
                    cls={cls}
                    guests={guests.data}
                    progress={progress.data ?? []}
                    onClose={() => setDialog(null)}
                    onSaved={() => {
                        setDialog(null);
                        changed();
                    }}
                />
            )}
            {dialog === 'edit' && (
                <ClassForm
                    classRow={cls}
                    instructors={instructors.data ?? []}
                    rooms={rooms.data ?? []}
                    venues={venues.data ?? []}
                    onClose={() => setDialog(null)}
                    onSaved={() => {
                        setDialog(null);
                        changed();
                    }}
                />
            )}
            {dialog === 'image' && (
                <ChangeClassImageForm
                    classRow={cls}
                    onClose={() => setDialog(null)}
                    onSaved={() => {
                        setDialog(null);
                        changed();
                    }}
                />
            )}
        </>
    );
};

export default ClassPage;
