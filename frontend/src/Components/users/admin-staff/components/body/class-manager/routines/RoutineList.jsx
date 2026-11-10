import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { splitSong } from '@/lib/lessons';
import LessonVideo from '../components/lessons/LessonVideo';
import RenewalLine from './RenewalLine';

// "Up next" or "Earlier routines": one row per routine (= course) with its dates, fee, how far it
// got, edit / delete, its class video and, for a planned course, its renewal. `renderEditor(routine)`
// replaces the row while it is being edited. `course` is { classPrice, current, renewals, opensAt }.
const RoutineList = ({ title, routines, course, editingId, renderEditor, onEdit, onRemove, onVideoSaved, onRenewalOpened }) => {
    const { t, tn, formatDate } = useI18n();
    if (routines.length === 0) return null;

    const when = (routine) => {
        if (routine.status === 'planned') {
            return routine.ends_on
                ? `${formatDate(routine.next_session ?? routine.starts_on, 'short')} → ${formatDate(routine.ends_on, 'short')}`
                : t('Starts {date}', { date: formatDate(routine.starts_on, 'short') });
        }
        if (routine.status === 'current') return t('{held} of {total} sessions', { held: routine.sessions_held, total: routine.session_count });
        if (routine.status === 'stopped') return t('Cut short at {held} of {total}', { held: routine.sessions_held, total: routine.session_count });
        return routine.ends_on ? t('Shoot day {date}', { date: formatDate(routine.ends_on, 'short') }) : '';
    };

    return (
        <section className="rtList" aria-label={title}>
            <h4 className="rtListTitle">{title}</h4>
            <ul>
                <AnimatePresence initial={false}>
                    {routines.map((routine) => {
                        const { song, artist } = splitSong(routine.title);
                        return (
                            <motion.li
                                key={routine.lesson_id}
                                layout="position"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: 24 }}
                                transition={{ duration: 0.22 }}
                                className={`rtRow is-${routine.status}`}
                            >
                                {editingId === routine.lesson_id ? (
                                    renderEditor(routine)
                                ) : (
                                    <>
                                        <div className="rtRowMain">
                                            <span className="rtRowDate" title={formatDate(routine.starts_on, 'full')}>
                                                <strong>{Number(routine.starts_on.slice(8, 10))}</strong>
                                                <small>{formatDate(routine.starts_on, 'monthShort')}</small>
                                            </span>
                                            <span className="rtRowText">
                                                <strong>
                                                    {song}
                                                    {artist && <span className="rtRowArtist"> — {artist}</span>}
                                                </strong>
                                                <small>
                                                    {[tn(routine.session_count, '{count} session', '{count} sessions'), when(routine), formatVnd(routine.price ?? course.classPrice)]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </small>
                                            </span>
                                            <span className="rtRowActions">
                                                <Button isIconOnly size="sm" variant="light" aria-label={t('Edit “{title}”', { title: routine.title })} onPress={() => onEdit(routine)}>
                                                    <LuPencil className="text-default-500" />
                                                </Button>
                                                <Button isIconOnly size="sm" variant="light" aria-label={t('Delete “{title}”', { title: routine.title })} onPress={() => onRemove(routine)}>
                                                    <LuTrash2 className="text-default-400" />
                                                </Button>
                                            </span>
                                        </div>
                                        {routine.status === 'planned' && (
                                            <RenewalLine
                                                className="isList"
                                                routine={routine}
                                                invoices={course.renewals?.get(routine.lesson_id)}
                                                current={course.current}
                                                opensAt={course.opensAt}
                                                onOpened={onRenewalOpened}
                                            />
                                        )}
                                        <LessonVideo lesson={routine} onSaved={onVideoSaved} />
                                    </>
                                )}
                            </motion.li>
                        );
                    })}
                </AnimatePresence>
            </ul>
        </section>
    );
};

export default RoutineList;
