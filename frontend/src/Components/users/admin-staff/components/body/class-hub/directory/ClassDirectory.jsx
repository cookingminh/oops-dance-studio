import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input } from '@nextui-org/react';
import { LuCalendarDays, LuPlus, LuSearch } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { deleteSchedule } from '@/services/schedules';
import { formatTime } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import AsyncState, { Empty } from '@/ui/feedback/AsyncState';
import SectionCard from '../../../common/SectionCard';
import Segmented from '../../../common/Segmented';
import { stagger } from '../../../common/motion';
import { roomColorMap } from '../../../common/chartTheme';
import { useStudioClock } from '../../../common/useStudioClock';
import { useStaffTasks } from '../../../../tasks/staffTasks';
import WeeklyTimetable from '../../class-manager/components/timetable/WeeklyTimetable';
import ScheduleForm from '../../class-manager/components/schedules/ScheduleForm';
import { VIEWS, classPath, matchesClass } from '../hubModel';
import { buildDirectory, loadDirectory } from './directoryData';
import ClassCard from './ClassCard';
import TodayList from './TodayList';
import NewClassWizard from './NewClassWizard';
import WebsiteTimetablePicker from './WebsiteTimetablePicker';

const EMPTY_TEXT = {
    today: 'No class meets today.',
    month: 'No class is running right now.',
    upcoming: 'No class is opening later. Create one with a start date ahead.',
    past: 'No class has ended yet.',
};

// /admin/classes: every class, by what you need to see — today's sessions, the month of each
// running class, classes opening later, past ones and the weekly timetable (with the look the website's
// timetable uses). A card opens the class's own page; "New class" walks through details, sessions, first
// routine and photo.
const ClassDirectory = () => {
    const { t, tn, dayName } = useI18n();
    const toast = useToast();
    const navigate = useNavigate();
    const { role } = useAuth();
    const isAdmin = role === ROLES.admin;
    const { refresh: refreshTasks } = useStaffTasks();
    const [params, setParams] = useSearchParams();
    const now = useStudioClock();
    const data = useAsync(() => loadDirectory(isAdmin), [isAdmin]);
    const model = useMemo(() => (data.data ? buildDirectory(data.data, now) : null), [data.data, now]);

    const [query, setQuery] = useState('');
    const [wizard, setWizard] = useState(false);
    const [session, setSession] = useState(undefined); // undefined = closed; { schedule, classId }

    const asked = params.get('view');
    const view = VIEWS.includes(asked) ? asked : model && model.todayItems.length === 0 ? 'month' : 'today';
    const setView = (key) =>
        setParams((old) => {
            const next = new URLSearchParams(old);
            next.set('view', key);
            return next;
        }, { replace: true });

    const reload = () => {
        data.reload();
        refreshTasks();
    };

    const filter = (list) => (list ?? []).filter((item) => matchesClass(item.cls, query.trim()));
    const lists = {
        today: filter(model?.todayItems),
        month: filter(model?.running),
        upcoming: filter(model?.upcoming),
        past: filter(model?.past),
    };
    const active = useMemo(() => (model ? [...model.running, ...model.upcoming].map((item) => item.cls) : []), [model]);
    const roomColor = roomColorMap(data.data?.rooms);

    const options = [
        { key: 'today', label: t('Today'), count: model ? lists.today.length : undefined },
        { key: 'month', label: t('This month'), count: model ? lists.month.length : undefined },
        { key: 'upcoming', label: t('Upcoming'), count: model ? lists.upcoming.length : undefined },
        { key: 'past', label: t('Past'), count: model ? lists.past.length : undefined },
        { key: 'timetable', label: t('Timetable') },
    ];

    const removeSession = async (slot) => {
        const question = t('Delete {name}’s {day} {time} session?', { name: slot.cls.name, day: dayName(slot.day_of_week), time: formatTime(slot.start_time) });
        if (!window.confirm(question)) return;
        try {
            await deleteSchedule(slot.id);
            toast.success('Schedule deleted.');
            reload();
        } catch (error) {
            toast.error(error);
        }
    };

    const subtitle = model
        ? [
            tn(model.running.length, '{count} class running', '{count} classes running'),
            model.upcoming.length ? tn(model.upcoming.length, '{count} opening soon', '{count} opening soon') : null,
            tn(model.todayItems.length, '{count} meets today', '{count} meet today'),
        ].filter(Boolean).join(' · ')
        : t('Loading classes…');

    return (
        <>
            <SectionCard
                className="hubDirectory"
                icon={LuCalendarDays}
                title={t('Classes')}
                subtitle={subtitle}
                actions={
                    <>
                        <Input
                            isClearable
                            aria-label={t('Search classes')}
                            placeholder={t('Search classes…')}
                            className="hubSearch"
                            startContent={<LuSearch className="text-default-400" aria-hidden="true" />}
                            value={query}
                            onValueChange={setQuery}
                            onClear={() => setQuery('')}
                        />
                        <Button color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={() => setWizard(true)}>
                            {t('New class')}
                        </Button>
                    </>
                }
            >
                <div className="hubViews">
                    <Segmented label={t('Show classes')} options={options} value={view} onChange={setView} />
                </div>
                {view !== 'timetable' && (
                    <AsyncState state={data} isEmpty={false}>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={view}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                            >
                                {lists[view].length === 0 ? (
                                    <Empty text={query.trim() ? 'No class matches your search.' : EMPTY_TEXT[view]} />
                                ) : view === 'today' ? (
                                    <TodayList items={lists.today} today={model.today} />
                                ) : (
                                    <motion.ul className="hubGrid" variants={stagger} initial="hidden" animate="show">
                                        {lists[view].map((item) => (
                                            <ClassCard key={item.cls.id} item={item} view={view} isAdmin={isAdmin} />
                                        ))}
                                    </motion.ul>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </AsyncState>
                )}
                {view === 'timetable' && (
                    <div className="hubTimetable">
                        <WebsiteTimetablePicker />
                        <WeeklyTimetable
                            state={{ ...data, data: data.data ? active : undefined }}
                            today={data.data?.today}
                            rooms={data.data?.rooms}
                            roomColor={roomColor}
                            actions={{
                                add: () => setSession({ schedule: null, classId: null }),
                                edit: (slot) => setSession({ schedule: slot, classId: slot.class_id }),
                                remove: removeSession,
                            }}
                        />
                    </div>
                )}
            </SectionCard>

            {wizard && (
                <NewClassWizard
                    today={data.data?.today}
                    onClose={() => setWizard(false)}
                    onCreated={reload}
                    onOpen={(id) => {
                        setWizard(false);
                        navigate(classPath(id, { tab: 'students', enrol: 1 }));
                    }}
                />
            )}
            {session !== undefined && (
                <ScheduleForm
                    schedule={session.schedule}
                    defaultClassId={session.classId}
                    classes={active}
                    onClose={() => setSession(undefined)}
                    onSaved={() => {
                        setSession(undefined);
                        reload();
                    }}
                />
            )}
        </>
    );
};

export default ClassDirectory;
