import { useEffect, useMemo, useState } from 'react';
import { TiSocialFacebook } from 'react-icons/ti';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { LEVELS } from '@/lib/classLevel';
import TimetableDisc from '@/ui/timetable/TimetableDisc';
import { AVATAR_FRAME, LEVEL_CIRCLES } from '@/ui/timetable/timetableFrame';
import { useI18n } from '@/i18n/i18nContext';
import logoMark from '@/assets/images/logo-mark.webp';
import { SOCIALS } from '../../../NavBar/contactInfo';
import { daysOf, placesOf, posterRowsOf } from './timetableModel';
import './posterTimetable.scss';

// The "poster" timetable: the studio's printed monthly schedule, live — a big title with the month, days
// across, one row per class line (a class keeps its row across its days, advanced classes at the bottom),
// each session a round instructor photo on its level's colour with the class name along the top edge and
// the time above it. The level key and the places close it. On phones each day is a row instead.

const NARROW = '(max-width: 719px)';
const useNarrow = () => {
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW).matches);
    useEffect(() => {
        const query = window.matchMedia(NARROW);
        const update = () => setNarrow(query.matches);
        update();
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    return narrow;
};

// Advanced classes go to the bottom rows, as on the printed schedule.
const rankOf = (cls) => (cls.level === 'advanced' ? 1 : 0);

// The class's own timetable photo (placed as staff framed it), else its instructor's avatar.
const photoOf = (cls) =>
    cls.timetable_photo_path
        ? {
              src: classImageUrl(cls.timetable_photo_path),
              alt: cls.instructor_name,
              frame: { x: cls.timetable_photo_x ?? 50, y: cls.timetable_photo_y ?? 50, zoom: cls.timetable_photo_zoom ?? 100 },
          }
        : cls.instructor_avatar_path
          ? { src: avatarUrl(cls.instructor_avatar_path), alt: cls.instructor_name, frame: AVATAR_FRAME }
          : null;

const Slot = ({ session, onPick }) => {
    const { t } = useI18n();
    const label = [
        t('{name} with {instructor}, {start}–{end}', {
            name: session.cls.name,
            instructor: session.cls.instructor_name,
            start: session.start,
            end: session.end,
        }),
        session.place.name,
    ]
        .filter(Boolean)
        .join(' · ');
    const Tag = onPick ? 'button' : 'div';
    return (
        <Tag className="weekSlot ttSlot" title={label} {...(onPick ? { type: 'button', onClick: () => onPick(session.cls.id) } : {})}>
            <span className="sr-only">{label}</span>
            <span className="ttTime" aria-hidden="true">
                {session.start}-{session.end}
            </span>
            <TimetableDisc name={session.cls.name} level={session.cls.level} photo={photoOf(session.cls)} />
        </Tag>
    );
};

const PosterTimetable = ({ sessions, today, todayDow, onPick, emptyText }) => {
    const { t, lang, formatDate, dayName } = useI18n();
    const narrow = useNarrow();
    const { days, rows, places, levels } = useMemo(
        () => ({
            days: daysOf(sessions),
            rows: posterRowsOf(sessions, rankOf),
            places: placesOf(sessions),
            levels: LEVELS.filter((level) => sessions.some((s) => s.cls.level === level.value)),
        }),
        [sessions],
    );
    // "T2" … "CN" in Vietnamese (as printed), "Mon" … "Sun" in English.
    const dayShort = (day) => (lang === 'vi' ? day.short : dayName(day.value, 'short'));
    const month = today ? formatDate(today, 'month') : '';

    return (
        <div className="ttPoster">
            <header className="ttHead">
                <div className="ttTitleWrap">
                    {month && <p className="ttMonth">{month.charAt(0).toUpperCase() + month.slice(1)}</p>}
                    <h2 className="ttTitle">{t('Timetable')}</h2>
                </div>
            </header>

            {emptyText ? (
                <p className="ttEmpty">{emptyText}</p>
            ) : narrow ? (
                <ol className="ttDays timeTableDiv" aria-label={t('Weekly timetable')}>
                    {days.map((day) => (
                        <li key={day.value} className={`ttDay${day.value === todayDow ? ' isToday' : ''}`}>
                            <span className="ttDayName">
                                <b>{dayShort(day)}</b>
                                <small>{day.value === todayDow ? t('Today') : dayName(day.value)}</small>
                            </span>
                            {day.sessions.length === 0 ? (
                                <span className="ttRest">{t('Rest day')}</span>
                            ) : (
                                <span className="ttDaySlots">
                                    {day.sessions.map((s) => (
                                        <Slot key={s.key} session={s} onPick={onPick} />
                                    ))}
                                </span>
                            )}
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="ttGridWrap">
                    <table className="ttGrid timeTableDiv">
                        <caption className="sr-only">{t('Weekly timetable')}</caption>
                        <thead>
                            <tr>
                                {days.map((day) => (
                                    <th key={day.value} scope="col" className={day.value === todayDow ? 'isToday' : undefined}>
                                        <abbr title={dayName(day.value)}>{dayShort(day)}</abbr>
                                        {day.value === todayDow && <span className="ttToday">{t('Today')}</span>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((cells, index) => (
                                <tr key={index}>
                                    {cells.map((session, column) => (
                                        <td key={column} className={column + 1 === todayDow ? 'isToday' : undefined}>
                                            {session && <Slot session={session} onPick={onPick} />}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <footer className="ttFoot">
                {levels.length > 0 && (
                    <ul className="ttLegend" aria-label={t('Class levels')}>
                        {levels.map((level) => (
                            <li key={level.value}>
                                <i style={{ backgroundImage: `url(${LEVEL_CIRCLES[level.value]})` }} aria-hidden="true" />
                                {t(level.legend)}
                            </li>
                        ))}
                    </ul>
                )}
                <div className="ttWhere">
                    <span className="ttLogo" aria-hidden="true">
                        <img src={logoMark} alt="" />
                    </span>
                    {places.length > 0 && (
                        <p>
                            {t('Classes held at')} <strong>{places.join(', ')}</strong>
                        </p>
                    )}
                    <a className="ttFanpage" href={SOCIALS.facebook} target="_blank" rel="noopener noreferrer">
                        <TiSocialFacebook aria-hidden="true" /> {t('News on our fanpage')}
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default PosterTimetable;
