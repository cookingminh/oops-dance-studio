import { LuMapPin, LuMusic } from 'react-icons/lu';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatTime, formatVnd } from '@/lib/format';
import { publicPlaceOf } from '@/lib/place';
import { useI18n } from '@/i18n/i18nContext';
import { PlaceDetails } from '@/ui/place/PlaceParts';

const initials = (name) =>
    name
        .split(/\s+/)
        .filter((word) => /^\p{L}/u.test(word))
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join('');

// One class from list_public_classes(): photo, coach, this month's song, weekly times, where (a rented
// studio's address and map link) and price.
// `anchor` gives it an id (#class-<id>) the timetable can jump to; a new `flash` value pulses its outline.
const ClassCard = ({ item, anchor = false, flash = 0 }) => {
    const { t, dayName } = useI18n();
    const place = publicPlaceOf(item);
    return (
        <article id={anchor ? `class-${item.id}` : undefined} className="hpClassCard">
            {flash > 0 && <span key={flash} className="hpClassFlash" aria-hidden="true" />}
            <div className="hpClassMedia">
                {item.image_path ? (
                    <img src={classImageUrl(item.image_path)} alt={item.name} loading="lazy" />
                ) : (
                    <span className="hpClassPlaceholder" aria-hidden="true">
                        {initials(item.name)}
                    </span>
                )}
            </div>
            <div className="hpClassBody">
                <h3>{item.name}</h3>
                <div className="hpClassTeacher">
                    {item.instructor_avatar_path && <img src={avatarUrl(item.instructor_avatar_path)} alt="" />}
                    <span>
                        {t('with')} <strong>{item.instructor_name}</strong>
                    </span>
                </div>
                {item.lesson && (
                    <p className="hpClassLesson">
                        <LuMusic aria-hidden="true" />
                        <span>
                            <small>{t('Now learning')}</small>
                            {item.lesson}
                        </span>
                    </p>
                )}
                <ul className="hpClassTimes" aria-label={t('Weekly sessions')}>
                    {(item.schedules ?? []).map((s) => (
                        <li key={`${s.day_of_week}-${s.start_time}`}>
                            <strong>{dayName(s.day_of_week, 'short')}</strong> {formatTime(s.start_time)}–{formatTime(s.end_time)}
                        </li>
                    ))}
                </ul>
                {place.name && (
                    <p className="hpClassPlace">
                        <LuMapPin aria-hidden="true" />
                        <PlaceDetails place={place} stacked />
                    </p>
                )}
                <div className="hpClassFoot">
                    <span className="hpClassPrice">{formatVnd(item.price)}</span>
                </div>
            </div>
        </article>
    );
};

export default ClassCard;
