import { AnimatePresence, motion } from 'framer-motion';
import { addDays, format, parseISO } from 'date-fns';
import { LuCalendarDays, LuDoorOpen, LuMusic, LuSparkles, LuUsers } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { classImageUrl } from '@/services/storage';
import { formatTime, isoWeekdayOf, toIsoDate } from '@/lib/format';
import { classHue, secondsUntil, splitDuration, startsInText, useStudioNow } from '../../profileHelpers';
import { makeUpOn, nextSessionWithMakeUps } from './routineView';

// The routine card lives in its own file; the overview pages import it from here.
export { default as LessonCard } from './LessonCard';

// Pieces of a class view (both roles). Styles: profile.scss (.pf*).

const hueStyle = (cls) => ({ '--hue': classHue(cls.id) });

// Square class picture; classes without a photo get their own coloured gradient.
export const ClassThumb = ({ cls, className = '' }) => {
    const src = classImageUrl(cls.image_path);
    return (
        <span className={`pfThumb ${className}`} style={hueStyle(cls)} aria-hidden="true">
            {src ? <img src={src} alt="" /> : <LuMusic />}
        </span>
    );
};

// 'Mon · Wed · Fri' from a class's weekly sessions.
export const WeekdayList = ({ schedules = [] }) => {
    const { dayName } = useI18n();
    const days = [...new Set(schedules.map((s) => s.day_of_week))].sort();
    return days.map((day) => dayName(day, 'short')).join(' · ');
};

// Big picture of the class with who, where and when.
export const ClassBanner = ({ cls, today, isInstructor }) => {
    const { t, tn, formatDate } = useI18n();
    const src = classImageUrl(cls.image_path);
    return (
        <div className="pfBanner" style={hueStyle(cls)}>
            {src ? (
                <img className="pfBannerImg" src={src} alt="" />
            ) : (
                <span className="pfBannerArt" aria-hidden="true">
                    <i />
                    <i />
                    <LuMusic className="pfNote1" />
                    <LuMusic className="pfNote2" />
                </span>
            )}
            <div className="pfBannerText">
                <h3>{cls.name}</h3>
                <ul className="pfBannerMeta">
                    {!isInstructor && cls.instructorName && (
                        <li>
                            {cls.instructorAvatar ? <img src={cls.instructorAvatar} alt="" /> : <LuUsers aria-hidden="true" />}
                            <span>
                                {t('with')} <strong>{cls.instructorName}</strong>
                            </span>
                        </li>
                    )}
                    <li>
                        <LuDoorOpen aria-hidden="true" /> {cls.roomName ?? t('No room')}
                    </li>
                    {cls.schedules.length > 0 && (
                        <li>
                            <LuCalendarDays aria-hidden="true" /> <WeekdayList schedules={cls.schedules} />
                        </li>
                    )}
                    {isInstructor ? (
                        <li>
                            <LuUsers aria-hidden="true" /> {tn(cls.students.length, '{count} student', '{count} students')}
                        </li>
                    ) : (
                        cls.joinedAt && (
                            <li>
                                <LuSparkles aria-hidden="true" />{' '}
                                {today && cls.joinedAt > today
                                    ? t('You join on {date}', { date: formatDate(cls.joinedAt, 'long') })
                                    : t('Dancing here since {date}', { date: formatDate(cls.joinedAt, 'monthYear') })}
                            </li>
                        )
                    )}
                </ul>
            </div>
        </div>
    );
};

// The coming week of one class: today first, a time on every day the class meets (make-up days
// too, for instructors).
export const WeekStrip = ({ cls, today, now }) => {
    const { t, formatDate } = useI18n();
    const days = Array.from({ length: 7 }, (_, offset) => toIsoDate(addDays(parseISO(today), offset)));
    let nextMarked = false;
    return (
        <section className="pfBlock pfWeek" aria-label={t('Next 7 days')}>
            <header className="pfBlockHead">
                <h4>{t('Next 7 days')}</h4>
                <span>
                    {formatDate(days[0], 'dayMonth')} – {formatDate(days[6], 'dayMonth')}
                </span>
            </header>
            <ol className="pfDays">
                {days.map((date, offset) => {
                    const makeUp = makeUpOn(cls, date);
                    const weekly = cls.schedules.find((s) => s.day_of_week === isoWeekdayOf(date));
                    const slot = makeUp ? { start_time: makeUp.start, end_time: makeUp.end } : weekly;
                    const ended = slot && offset === 0 && now >= formatTime(slot.end_time);
                    const live = slot && offset === 0 && !ended && now >= formatTime(slot.start_time);
                    const isNext = Boolean(slot) && !ended && !nextMarked;
                    if (isNext) nextMarked = true;
                    const classes = ['pfDay', slot && 'hasClass', makeUp && 'isMakeUp', offset === 0 && 'isToday', isNext && 'isNext', ended && 'isDone', live && 'isLive'];
                    return (
                        <li key={date} className={classes.filter(Boolean).join(' ')}>
                            {/* Today is marked by colour and outline; "Today" itself is too wide for a phone. */}
                            <small>
                                {formatDate(date, 'weekdayShort')}
                                {offset === 0 && <span className="sr-only"> ({t('Today')})</span>}
                            </small>
                            <strong>{format(parseISO(date), 'd')}</strong>
                            {slot ? (
                                <span className="pfDayTime">
                                    {live && <span className="pfPulse" aria-hidden="true" />}
                                    {formatTime(slot.start_time)}
                                    {makeUp && <span className="sr-only"> ({t('Make-up')})</span>}
                                </span>
                            ) : (
                                <span className="pfDayRest">
                                    <span className="sr-only">{t('No class')}</span>
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </section>
    );
};

const pad = (value) => String(value).padStart(2, '0');

// A number that rolls when it changes (seconds, minutes …).
const RollingNumber = ({ value }) => (
    <span className="pfRoll">
        <AnimatePresence initial={false} mode="popLayout">
            <motion.span
                key={value}
                initial={{ y: '-70%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '70%', opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
                {pad(value)}
            </motion.span>
        </AnimatePresence>
    </span>
);

// Live countdown to `session` ({ date, start, end }); a pulsing "happening now" once it started.
export const Countdown = ({ session, today, size = 'lg' }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const { seconds } = useStudioNow(1000);
    const left = secondsUntil(session, today, seconds);

    if (left <= 0) {
        return (
            <div className={`pfCountdown isLive size-${size}`} role="timer" aria-label={t('Happening now')}>
                <span className="pfLiveTag">
                    <span className="pfPulse" aria-hidden="true" /> {t('Happening now')}
                </span>
                <small>{t('Ends at {time}', { time: session.end })}</small>
            </div>
        );
    }

    const { days, hours, minutes, seconds: secs } = splitDuration(left);
    const units = days > 0
        ? [{ value: days, label: 'days' }, { value: hours, label: 'hrs' }, { value: minutes, label: 'min' }]
        : [{ value: hours, label: 'hrs' }, { value: minutes, label: 'min' }, { value: secs, label: 'sec' }];
    return (
        <div className={`pfCountdown size-${size}`} role="timer" aria-label={startsInText(session, today, seconds, i18n)}>
            {units.map((unit) => (
                <span key={unit.label} className="pfUnit" aria-hidden="true">
                    <RollingNumber value={unit.value} />
                    <small>{t(unit.label)}</small>
                </span>
            ))}
        </div>
    );
};

// "Today" / "Tomorrow" / "Tuesday 10 November".
export const DayName = ({ date, today, style = 'long' }) => {
    const { t, formatDate } = useI18n();
    if (date === today) return t('Today');
    if (date === toIsoDate(addDays(parseISO(today), 1))) return t('Tomorrow');
    return formatDate(date, style);
};

// When the class meets next, in one short line ("Tomorrow · 18:00"), make-up sessions included.
export const NextLine = ({ cls, today, now }) => {
    const { t } = useI18n();
    const next = nextSessionWithMakeUps(cls, today, now);
    if (!next) return t('No weekly sessions yet');
    if (next.isLive) return t('Happening now');
    return (
        <>
            <DayName date={next.date} today={today} style="weekday" /> · {next.start}
        </>
    );
};

// "in 2 h 15 min" / "Happening now", refreshed every 15 seconds.
export const StartsIn = ({ session, today }) => {
    const i18n = useI18n();
    const { seconds } = useStudioNow(15_000);
    return startsInText(session, today, seconds, i18n);
};
