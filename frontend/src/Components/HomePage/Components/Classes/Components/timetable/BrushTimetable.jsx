import { useMemo } from 'react';
import { TiSocialFacebook } from 'react-icons/ti';
import { LuMapPin } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import timetable_bg from '@/assets/images/timetable-bg.webp';
import brush from '@/assets/images/timetable-class-bg.webp';
import { SOCIALS } from '../../../NavBar/contactInfo';
import { daysOf, placesOf } from './timetableModel';

// Vietnamese month names are lowercase ("tháng 11 năm 2026"); this one starts a line.
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// The "red card" timetable (the first design): one column per day on red paper, sessions in time order,
// each a brush-stroke badge with the instructor's photo and where it is taught; the places in one line above.
// Compact on purpose; on small screens the columns scroll sideways.
const BrushTimetable = ({ sessions, today, todayDow, onPick, emptyText }) => {
    const { t, formatDate, dayName } = useI18n();
    const { days, places } = useMemo(() => ({ days: daysOf(sessions), places: placesOf(sessions) }), [sessions]);

    return (
        <div className="hpTimetableCard" style={{ backgroundImage: `url(${timetable_bg})` }}>
            <header className="hpTimetableHead" data-aos="fade-up">
                <div>
                    <h2>{t('Our weekly timetable')}</h2>
                    <p>
                        {today ? capitalize(formatDate(today, 'monthYear')) : '…'}
                        {sessions.length > 0 && ` · ${t('{count} classes a week', { count: sessions.length })}`}
                    </p>
                </div>
                <a className="hpFacebook" href={SOCIALS.facebook} target="_blank" rel="noopener noreferrer">
                    <TiSocialFacebook aria-hidden="true" /> {t('News on our fanpage')}
                </a>
            </header>

            {places.length > 0 && (
                <p className="hpTimetablePlaces" data-aos="fade-up">
                    <LuMapPin aria-hidden="true" />
                    <span>
                        {t('Classes held at')} <strong>{places.join(', ')}</strong>
                    </span>
                </p>
            )}

            {emptyText ? (
                <p className="hpTimetableEmpty">{emptyText}</p>
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
                                const label = [
                                    t('{name} with {instructor}, {start}–{end}', {
                                        name: s.cls.name,
                                        instructor: s.cls.instructor_name,
                                        start: s.start,
                                        end: s.end,
                                    }),
                                    s.place.name,
                                ]
                                    .filter(Boolean)
                                    .join(' · ');
                                const Slot = onPick ? 'button' : 'div';
                                return (
                                    <Slot
                                        key={s.key}
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
                                                <img
                                                    className="instructor"
                                                    src={avatarUrl(s.cls.instructor_avatar_path)}
                                                    alt={s.cls.instructor_name}
                                                    loading="lazy"
                                                />
                                            )}
                                        </span>
                                        {s.place.name && <span className="weekSlotPlace">{s.place.name}</span>}
                                    </Slot>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BrushTimetable;
