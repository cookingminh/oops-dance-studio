import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { TiSocialFacebook } from 'react-icons/ti';
import { getStudioToday } from '@/services/studio';
import { avatarUrl } from '@/services/storage';
import { WEEKDAYS, formatTime, isoWeekdayOf } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import timetable_bg from '@/assets/images/timetable-bg.webp';
import brush from '@/assets/images/timetable-class-bg.webp';
import { SOCIALS } from '../../NavBar/contactInfo';

// Vietnamese month names are lowercase ("tháng 11 năm 2026"); this one starts a line.
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// The week at a glance: one column per day (ISO weekday 1–7), sessions in time order.
// Compact on purpose; on small screens the columns scroll sideways. `onPick(classId)` makes each
// session a button that shows that class's card.
const TimeTable = ({ classes, onPick }) => {
    const { t, formatDate, dayName } = useI18n();
    const [today, setToday] = useState(null);

    useEffect(() => {
        getStudioToday().then(setToday).catch(() => setToday(format(new Date(), 'yyyy-MM-dd')));
    }, []);

    const { days, count } = useMemo(() => {
        const sessions = (classes.data ?? []).flatMap((item) =>
            (item.schedules ?? []).map((s) => ({ ...s, start: formatTime(s.start_time), end: formatTime(s.end_time), cls: item }))
        );
        return {
            count: sessions.length,
            days: WEEKDAYS.map((day) => ({
                ...day,
                sessions: sessions.filter((s) => s.day_of_week === day.value).sort((a, b) => a.start.localeCompare(b.start)),
            })),
        };
    }, [classes.data]);

    const todayDow = today ? isoWeekdayOf(today) : null;

    return (
        <section id="timetable" className="hpTimetable">
            <div className="hpTimetableCard" style={{ backgroundImage: `url(${timetable_bg})` }}>
                <header className="hpTimetableHead" data-aos="fade-up">
                    <div>
                        <h2>{t('Our weekly timetable')}</h2>
                        <p>
                            {today ? capitalize(formatDate(today, 'monthYear')) : '…'}
                            {count > 0 && ` · ${t('{count} classes a week', { count })}`}
                        </p>
                    </div>
                    <a className="hpFacebook" href={SOCIALS.facebook} target="_blank" rel="noopener noreferrer">
                        <TiSocialFacebook aria-hidden="true" /> {t('News on our fanpage')}
                    </a>
                </header>

                {count === 0 ? (
                    <p className="hpTimetableEmpty">{classes.loading ? t('Loading the timetable…') : t('The timetable will be published soon.')}</p>
                ) : (
                    <div className="timeTableDiv" role="list" aria-label={t('Weekly timetable')}>
                        {days.map((day, index) => (
                            <div
                                key={day.value}
                                role="listitem"
                                className={`weekDay${day.value === todayDow ? ' isToday' : ''}`}
                                data-aos="fade-up"
                                data-aos-delay={index * 50}
                            >
                                <div className="weekDayHead">
                                    <strong>{day.short}</strong>
                                    <span>{day.value === todayDow ? t('Today') : dayName(day.value)}</span>
                                </div>
                                {day.sessions.length === 0 && <span className="weekDayOff">{t('Rest day')}</span>}
                                {day.sessions.map((s) => {
                                    const label = t('{name} with {instructor}, {start}–{end}', { name: s.cls.name, instructor: s.cls.instructor_name, start: s.start, end: s.end });
                                    const Slot = onPick ? 'button' : 'div';
                                    return (
                                        <Slot
                                            key={`${s.cls.id}-${s.start}`}
                                            className="weekSlot"
                                            title={label}
                                            {...(onPick ? { type: 'button', onClick: () => onPick(s.cls.id) } : {})}
                                        >
                                            <span className="weekSlotTime">
                                                {s.start} – {s.end}
                                            </span>
                                            <span className="weekSlotBadge" style={{ '--brush': `url(${brush})` }}>
                                                <span className="weekSlotName">{s.cls.name}</span>
                                                {s.cls.instructor_avatar_path && (
                                                    <img className="instructor" src={avatarUrl(s.cls.instructor_avatar_path)} alt={s.cls.instructor_name} loading="lazy" />
                                                )}
                                            </span>
                                        </Slot>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default TimeTable;
