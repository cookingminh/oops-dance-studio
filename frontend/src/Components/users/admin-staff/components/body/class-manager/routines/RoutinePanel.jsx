import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuPlus } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { deleteClassLesson } from '@/services/classes';
import { routineIssues, routineState, suggestedStart } from '@/lib/lessons';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';
import AsyncState from '@/ui/feedback/AsyncState';
import { RoutineEmpty, RoutineHero } from './RoutineHero';
import RoutineNotices from './RoutineNotices';
import RoutineForm from './RoutineForm';
import RoutineList from './RoutineList';
import MakeUpDialog from './MakeUpDialog';
import { dateOptions, inRoutine, loadRoutines } from './routineData';
import './routines.scss';

const reveal = {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' },
    exit: { opacity: 0, height: 0 },
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
};

// Everything about a class's routines, standalone (the class page and the Classes dialog embed it):
// the routine it is on (sessions held, next and last session = shoot day), cancelled sessions and
// make-ups, overlaps and gaps, planning the next routine with a live end date, and the routines
// before and after with their class videos. `cls` needs { id, name, room_id, room, starts_on,
// ended_on, schedules, price }; `onChanged()` runs after every change (to refresh the class list,
// the to-do…). Each routine is also a course: its fee, and the renewal of a planned one.
const RoutinePanel = ({ cls, today, onChanged }) => {
    const toast = useToast();
    const { t } = useI18n();
    const data = useAsync(() => loadRoutines(cls.id), [cls.id]);
    const [editingId, setEditingId] = useState(null);
    const [planOpen, setPlanOpen] = useState(null); // null = open only when a routine is needed
    const [makeUpOpen, setMakeUpOpen] = useState(false);

    const routines = data.data?.routines ?? [];
    const makeUps = data.data?.makeUps ?? [];
    const options = dateOptions(data.data);
    const state = routineState(routines);
    const hero = state.current ?? state.next;
    const issues = data.data ? routineIssues(cls, routines, today, options) : [];
    const planning = planOpen ?? state.needsNext;
    const uncovered = state.current && state.current.sessions_cancelled > makeUps.filter((row) => inRoutine(state.current, row.date)).length;
    const latest = state.routines.at(-1);
    // Finished routines, and an older one still running next to the current one (an overlap).
    const earlier = state.routines.filter((routine) => routine !== hero && routine.status !== 'planned').reverse();
    const course = {
        classPrice: cls.price,
        current: state.current,
        renewals: data.data?.renewals,
        opensAt: data.data?.renewalOpensAt ?? 2,
    };

    const changed = async () => {
        await data.reload();
        onChanged?.();
    };

    const remove = async (routine) => {
        const question = routine.video_url
            ? t('Delete the routine “{title}”? Its class video link goes too.', { title: routine.title })
            : t('Delete the routine “{title}”?', { title: routine.title });
        if (!window.confirm(question)) return;
        try {
            await deleteClassLesson(routine.lesson_id);
            toast.success('Routine deleted.');
            setEditingId(null);
            changed();
        } catch (error) {
            toast.error(error);
        }
    };

    const actions = {
        edit: (routine) => setEditingId(routine.lesson_id),
        remove,
        addMakeUp: () => setMakeUpOpen(true),
        videoSaved: changed,
        renewalOpened: changed,
    };

    const editor = (routine) => (
        <RoutineForm
            key={routine.lesson_id}
            cls={cls}
            routines={routines}
            options={options}
            idPrefix={`routine-${routine.lesson_id}`}
            initial={{ id: routine.lesson_id, title: routine.title, startsOn: routine.starts_on, sessionCount: routine.session_count, price: routine.price }}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
                setEditingId(null);
                changed();
            }}
        />
    );

    return (
        <div className="rtPanel">
            <AsyncState state={data} isEmpty={false}>
                {hero ? (
                    editingId === hero.lesson_id ? (
                        <div className="rtHero isEditing">{editor(hero)}</div>
                    ) : (
                        <RoutineHero
                            routine={hero}
                            makeUps={makeUps.filter((row) => row.date >= today || inRoutine(hero, row.date))}
                            today={today}
                            course={{ ...course, invoices: course.renewals?.get(hero.lesson_id) }}
                            actions={actions}
                            // The cancelled-session notice below offers it when sessions were cancelled.
                            offerMakeUp={!uncovered}
                        />
                    )
                ) : (
                    <RoutineEmpty last={state.last} planning={planning} onPlan={() => setPlanOpen(true)} />
                )}

                <RoutineNotices current={state.current} makeUps={makeUps} issues={issues} onAddMakeUp={() => setMakeUpOpen(true)} />

                <section className="rtPlan" aria-label={t('Plan the next routine')}>
                    <AnimatePresence initial={false} mode="wait">
                        {planning ? (
                            <motion.div key="form" className="rtPlanBody" {...reveal}>
                                <h4 className="rtListTitle">{t('Plan the next routine')}</h4>
                                <RoutineForm
                                    key={routines.length}
                                    cls={cls}
                                    routines={routines}
                                    options={options}
                                    idPrefix="routine-new"
                                    initial={{
                                        title: '',
                                        sessionCount: latest?.session_count ?? 8,
                                        startsOn: suggestedStart(cls, routines, today, options),
                                        price: null, // the class price
                                    }}
                                    onCancel={state.needsNext ? undefined : () => setPlanOpen(false)}
                                    onSaved={() => {
                                        setPlanOpen(null);
                                        changed();
                                    }}
                                />
                            </motion.div>
                        ) : (
                            <motion.button key="open" type="button" className="rtPlanOpen" onClick={() => setPlanOpen(true)} {...reveal}>
                                <LuPlus aria-hidden="true" />
                                {t('Plan the next routine')}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </section>

                <RoutineList
                    title={t('Up next')}
                    routines={state.upcoming.filter((routine) => routine !== hero)}
                    course={course}
                    editingId={editingId}
                    renderEditor={editor}
                    onEdit={actions.edit}
                    onRemove={remove}
                    onVideoSaved={changed}
                    onRenewalOpened={changed}
                />
                <RoutineList
                    title={t('Earlier routines')}
                    routines={earlier}
                    course={course}
                    editingId={editingId}
                    renderEditor={editor}
                    onEdit={actions.edit}
                    onRemove={remove}
                    onVideoSaved={changed}
                    onRenewalOpened={changed}
                />
            </AsyncState>

            {makeUpOpen && (
                <MakeUpDialog
                    cls={cls}
                    today={today}
                    makeUps={makeUps}
                    onClose={() => setMakeUpOpen(false)}
                    onAdded={() => {
                        setMakeUpOpen(false);
                        changed();
                    }}
                />
            )}
        </div>
    );
};

export default RoutinePanel;
