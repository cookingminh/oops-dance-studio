import { Button } from '@nextui-org/react';
import { LuBanknote, LuCalendarPlus, LuDisc3, LuFlag, LuPencil, LuPlus, LuTimer, LuTrash2 } from 'react-icons/lu';
import { formatTime, formatVnd } from '@/lib/format';
import { remainingSessions, splitSong } from '@/lib/lessons';
import { useI18n } from '@/i18n/i18nContext';
import LessonVideo from '../components/lessons/LessonVideo';
import RoutineProgress from './RoutineProgress';
import MakeUpTag from './MakeUpTag';
import RenewalLine from './RenewalLine';

// The routine the class is on now (or, between routines, the next one): song, sessions held, the next
// session and the projected last one (the shoot day), its course fee, the make-up sessions that count
// for it, its class video and — for a planned course — its renewal. `course` is { classPrice, current,
// invoices (planned course), opensAt }.
export const RoutineHero = ({ routine, makeUps, today, course, actions, offerMakeUp = true }) => {
    const { t, tn, formatDate } = useI18n();
    const { song, artist } = splitSong(routine.title);
    const isCurrent = routine.status === 'current';
    const left = remainingSessions(routine);

    let eyebrow = t('Now learning');
    if (!isCurrent) eyebrow = t('Up next · starts {date}', { date: formatDate(routine.next_session ?? routine.starts_on, 'short') });

    return (
        <section className={`rtHero${isCurrent ? ' isCurrent' : ' isPlanned'}`} aria-label={eyebrow}>
            <div className="rtHeroTop">
                <span className={`rtDisc${isCurrent ? ' isPlaying' : ''}`} aria-hidden="true">
                    <LuDisc3 />
                </span>
                <div className="rtHeroText">
                    <small className="rtEyebrow">{eyebrow}</small>
                    <h3 className="rtSong">{song}</h3>
                    {artist && <span className="rtArtist">{artist}</span>}
                </div>
                <div className="rtHeroActions">
                    <Button isIconOnly size="sm" variant="light" aria-label={t('Edit “{title}”', { title: routine.title })} onPress={() => actions.edit(routine)}>
                        <LuPencil className="text-default-500" />
                    </Button>
                    <Button isIconOnly size="sm" variant="light" aria-label={t('Delete “{title}”', { title: routine.title })} onPress={() => actions.remove(routine)}>
                        <LuTrash2 className="text-default-400" />
                    </Button>
                </div>
            </div>

            <div className="rtHeroProgress">
                <RoutineProgress held={routine.sessions_held} total={routine.session_count} />
                <p>
                    {isCurrent ? (
                        <>
                            <strong>{t('{held} of {total} sessions', { held: routine.sessions_held, total: routine.session_count })}</strong>
                            {' · '}
                            {t('{count} to go', { count: left })}
                        </>
                    ) : (
                        <strong>{tn(routine.session_count, '{count} session', '{count} sessions')}</strong>
                    )}
                </p>
            </div>

            <dl className="rtFacts">
                <div>
                    <dt>
                        <LuTimer aria-hidden="true" /> {isCurrent ? t('Next session') : t('First session')}
                    </dt>
                    <dd>{routine.next_session ? formatDate(routine.next_session, 'short') : '—'}</dd>
                </div>
                <div className="isShoot">
                    <dt>
                        <LuFlag aria-hidden="true" /> {t('Last session · shoot day')}
                    </dt>
                    <dd>{routine.ends_on ? formatDate(routine.ends_on, 'short') : t('Not reached')}</dd>
                </div>
            </dl>

            <p className="rtCourse">
                <LuBanknote aria-hidden="true" />
                {t('Course fee')} <strong>{formatVnd(routine.price ?? course.classPrice)}</strong>
                {routine.price === null && <span>· {t('the class price')}</span>}
            </p>
            {!isCurrent && (
                <RenewalLine routine={routine} invoices={course.invoices} current={course.current} opensAt={course.opensAt} onOpened={actions.renewalOpened} />
            )}

            {makeUps.length > 0 && (
                <ul className="rtMakeUps" aria-label={t('Make-up sessions')}>
                    {makeUps.map((row) => (
                        <li key={row.id} className={row.date < today ? 'isPast' : undefined}>
                            <MakeUpTag />
                            <span>
                                <strong>{formatDate(row.date, 'short')}</strong> · {formatTime(row.start_time)}–{formatTime(row.end_time)}
                                {row.details && <em> · {row.details}</em>}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            <footer className="rtHeroFoot">
                <LessonVideo lesson={routine} onSaved={actions.videoSaved} />
                {offerMakeUp && (
                    <Button size="sm" variant="flat" className="rtMakeUpBtn" startContent={<LuCalendarPlus aria-hidden="true" />} onPress={actions.addMakeUp}>
                        {t('Add a make-up session')}
                    </Button>
                )}
            </footer>
        </section>
    );
};

// No routine now and none planned: say what the class last learned and offer to plan the next one.
export const RoutineEmpty = ({ last, onPlan, planning }) => {
    const { t, formatDate } = useI18n();
    return (
        <section className="rtHero isEmpty" aria-label={t('No routine right now')}>
            <div className="rtHeroTop">
                <span className="rtDisc" aria-hidden="true">
                    <LuDisc3 />
                </span>
                <div className="rtHeroText">
                    <small className="rtEyebrow">{t('No routine right now')}</small>
                    <h3 className="rtSong">{t('Pick the next routine')}</h3>
                    <span className="rtArtist">
                        {last
                            ? t('Last: “{title}”, shoot day {date}', { title: last.title, date: formatDate(last.ends_on ?? last.starts_on, 'short') })
                            : t('Students see the song they’re learning and when it’s filmed.')}
                    </span>
                </div>
            </div>
            {!planning && (
                <footer className="rtHeroFoot">
                    <Button size="sm" color="danger" startContent={<LuPlus aria-hidden="true" />} onPress={onPlan}>
                        {t('Plan the next routine')}
                    </Button>
                </footer>
            )}
        </section>
    );
};
