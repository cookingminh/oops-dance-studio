import AsyncState from '@/ui/feedback/AsyncState';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import defaultAvatar from '@/assets/images/avatar-placeholder.webp';

// One soft colour per instructor card, in a fixed order.
const TONES = ['rose', 'amber', 'violet', 'teal', 'sky', 'coral'];

// Instructors from the public class list (no profile data is exposed): each one once, with
// the classes they teach and how many sessions a week. `fallbackName` names a class without one.
function instructorsOf(classes, fallbackName) {
    const byName = new Map();
    for (const item of classes) {
        const key = item.instructor_name ?? fallbackName;
        const entry = byName.get(key) ?? { name: key, avatarPath: item.instructor_avatar_path, classes: [], sessions: 0 };
        entry.avatarPath ??= item.instructor_avatar_path;
        entry.classes.push(item.name);
        entry.sessions += (item.schedules ?? []).length;
        byName.set(key, entry);
    }
    return [...byName.values()].sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
}

const Participants = ({ classes }) => {
    const { t, tn } = useI18n();
    return (
        <section id="instructors" className="hpInstructors">
            <header className="hpSectionHead isCentered" data-aos="fade-up">
                <div>
                    <span className="hpEyebrow">{t('The team')}</span>
                    <h2>{t('Meet our instructors')}</h2>
                    <p>{t('Every instructor is a member of Oops! Crew, one of Hanoi’s best-known dance crews, and teaches the routines they perform.')}</p>
                </div>
            </header>

            <AsyncState state={classes} emptyText="Our instructors will be introduced soon.">
                {(list) => (
                    <div className="hpCoachGrid">
                        {instructorsOf(list, t('Instructor')).map((coach, index) => (
                            <article
                                key={coach.name}
                                className={`hpCoach tone-${TONES[index % TONES.length]}`}
                                data-aos="fade-up"
                                data-aos-delay={index * 70}
                            >
                                <div className="hpCoachPhoto">
                                    <span className="hpCoachBlob" aria-hidden="true" />
                                    <span className="hpCrewBadge">Oops! Crew</span>
                                    <img src={avatarUrl(coach.avatarPath) ?? defaultAvatar} alt={coach.name} loading="lazy" />
                                </div>
                                <div className="hpCoachInfo">
                                    <h3>{coach.name}</h3>
                                    <p>
                                        {tn(coach.classes.length, '{count} class', '{count} classes')} ·{' '}
                                        {tn(coach.sessions, '{count} session a week', '{count} sessions a week')}
                                    </p>
                                    <ul>
                                        {coach.classes.map((name) => (
                                            <li key={name}>{name}</li>
                                        ))}
                                    </ul>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </AsyncState>
        </section>
    );
};

export default Participants;
