import { LuAlertTriangle, LuArrowRight, LuFlag, LuMusic, LuPlay } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { routineState, splitSong } from '@/lib/lessons';
import { youtubeId, youtubeWatch } from '@/lib/youtube';
import RoutineProgress from '../../../../../admin-staff/components/body/class-manager/routines/RoutineProgress';
import { classHue } from '../../profileHelpers';
import './routineCard.scss';

// The routine a class is learning, on a spinning record: how far it is ("4 of 8 sessions · last
// session Wed 18 Nov (shoot day)"), the routine after it if one is planned, and the earlier ones with
// their class videos. `cls.routines` are lesson_progress rows (classData.js).
const LessonCard = ({ cls, today, isInstructor, compact = false }) => {
    const { t, tn, formatDate, monthName } = useI18n();
    const state = routineState(cls.routines);
    const routine = state.current ?? state.next;
    const { song, artist } = splitSong(routine?.title);
    const upNext = state.current ? state.next : state.upcoming[1] ?? null;
    const earlier = compact ? [] : state.history.slice(0, 3);
    const date = (iso) => formatDate(iso, 'short');
    const stale = isInstructor && today && state.needsNext;

    let label = t('No routine yet');
    if (state.current) label = t('Now learning');
    else if (state.next) label = t('Up next');

    let progress = null;
    if (state.current) {
        progress = state.current.ends_on
            ? t('{held} of {total} sessions · last session {date} (shoot day)', { held: state.current.sessions_held, total: state.current.session_count, date: date(state.current.ends_on) })
            : t('{held} of {total} sessions', { held: state.current.sessions_held, total: state.current.session_count });
    } else if (state.next) {
        progress = tn(state.next.session_count, 'Starts {date} · {count} session', 'Starts {date} · {count} sessions', { date: date(state.next.next_session ?? state.next.starts_on) });
    }

    return (
        <section className={`pfBlock pfLesson pfRoutine${stale ? ' isStale' : ''}`} style={{ '--hue': classHue(cls.id) }} aria-label={label}>
            <div className="pfLessonMain">
                <span className={`pfVinyl${state.current ? ' isPlaying' : ''}`} aria-hidden="true">
                    <span className="pfVinylLabel">
                        <LuMusic />
                    </span>
                </span>
                <div className="pfLessonText">
                    <small className="pfEyebrow">{label}</small>
                    <strong className="pfSong">{song || t('The studio will set it soon')}</strong>
                    {artist && <span className="pfArtist">{artist}</span>}
                </div>
            </div>

            {routine && (
                <div className="pfRoutineProgress">
                    <RoutineProgress held={routine.sessions_held} total={routine.session_count} size={compact ? 'sm' : 'md'} />
                    <p>
                        {state.current?.ends_on && <LuFlag aria-hidden="true" />}
                        {progress}
                    </p>
                </div>
            )}

            {upNext && !compact && (
                <p className="pfRoutineNext">
                    <LuArrowRight aria-hidden="true" />
                    <span>
                        {t('Up next')}: <strong>{upNext.title}</strong> · {t('from {date}', { date: date(upNext.next_session ?? upNext.starts_on) })}
                    </span>
                </p>
            )}

            {stale && (
                <p className="pfStaleNote">
                    <LuAlertTriangle aria-hidden="true" />{' '}
                    {state.current
                        ? tn(state.remaining, '{count} session left and the next routine isn’t picked yet. The studio will add it soon.', '{count} sessions left and the next routine isn’t picked yet. The studio will add it soon.')
                        : t('No routine right now. The studio will pick the next one soon.')}
                </p>
            )}

            {earlier.length > 0 && (
                <div className="pfEarlier">
                    <small className="pfEyebrow">{t('Earlier songs')}</small>
                    <ul>
                        {earlier.map((item) => {
                            const videoId = youtubeId(item.video_url);
                            return (
                                <li key={item.lesson_id}>
                                    <span className="pfEarlierMonth" title={monthName(item.starts_on, { withYear: true })}>
                                        {formatDate(item.starts_on, 'monthShort')}
                                    </span>
                                    <span className="pfEarlierTitle">{item.title}</span>
                                    {videoId && (
                                        <a
                                            className="pfEarlierVideo"
                                            href={youtubeWatch(videoId)}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={t('Watch the class video of “{title}”', { title: item.title })}
                                        >
                                            <LuPlay aria-hidden="true" /> {t('Video')}
                                        </a>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
};

export default LessonCard;
