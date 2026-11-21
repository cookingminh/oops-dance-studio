import { LuClock, LuMapPin, LuMusic, LuSparkles } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { avatarUrl, classImageUrl } from '@/services/storage';
import { formatTime } from '@/lib/format';
import { imagePositionOf } from '@/lib/classImage';
import { levelOf } from '@/lib/classLevel';
import { splitSong } from '@/lib/lessons';
import { publicPlaceOf } from '@/lib/place';
import { PlaceDetails } from '@/ui/place/PlaceParts';

// Pieces both join dialogs share (JoinDialog, RequestDialog). `item` is a list_public_classes() row.

// The dialog's head: the class's picture, its name and its coach, under a small label.
export const ClassHead = ({ item, eyebrow }) => {
    const { t } = useI18n();
    const src = classImageUrl(item.image_path);
    return (
        <div className="jnHead">
            <span className="jnCover" aria-hidden="true">
                {src ? <img src={src} alt="" style={{ objectPosition: imagePositionOf(item) }} /> : <LuMusic />}
            </span>
            <span className="jnHeadText">
                <small className="jnEyebrow">{eyebrow}</small>
                <strong className="jnName">{item.name}</strong>
                {item.instructor_name && (
                    <span className="jnTeacher">
                        {item.instructor_avatar_path && <img src={avatarUrl(item.instructor_avatar_path)} alt="" />}
                        <span>
                            {t('with')} <b>{item.instructor_name}</b>
                        </span>
                    </span>
                )}
            </span>
        </div>
    );
};

// Level, weekly times and where it's taught.
export const ClassFacts = ({ item }) => {
    const { t, dayName } = useI18n();
    const level = item.level ? levelOf(item.level) : null;
    const place = publicPlaceOf(item);
    return (
        <div className="jnFacts">
            <ul aria-label={t('Weekly sessions')}>
                {level && (
                    <li className="jnLevel" style={{ '--dot': level.color }}>
                        {t(level.label)}
                    </li>
                )}
                {(item.schedules ?? []).map((s) => (
                    <li key={`${s.day_of_week}-${s.start_time}`}>
                        <LuClock aria-hidden="true" />
                        <strong>{dayName(s.day_of_week, 'short')}</strong> {formatTime(s.start_time)}–{formatTime(s.end_time)}
                    </li>
                ))}
            </ul>
            {place.name && (
                <p className="jnPlace">
                    <LuMapPin aria-hidden="true" />
                    <PlaceDetails place={place} stacked />
                </p>
            )}
        </div>
    );
};

// One course: the song (and its artist, like the class pages), under "Now learning" or "Next course".
export const CourseLine = ({ kind, course, meta }) => {
    const { t } = useI18n();
    const { song, artist } = splitSong(course.title);
    return (
        <li className={`jnCourse is-${kind}`}>
            <span className="jnCourseIcon" aria-hidden="true">
                {kind === 'now' ? <LuMusic /> : <LuSparkles />}
            </span>
            <span className="jnCourseText">
                <small>{kind === 'now' ? t('Now learning') : t('Next course')}</small>
                <strong>
                    “{song}”{artist && <span className="jnArtist"> — {artist}</span>}
                </strong>
                <span className="jnCourseMeta">{meta}</span>
            </span>
        </li>
    );
};

// Shimmer while the courses load.
export const CoursesSkeleton = () => {
    const { t } = useI18n();
    return (
        <div className="jnSkeleton" role="status" aria-label={t('Loading…')}>
            <span />
            <span />
        </div>
    );
};
