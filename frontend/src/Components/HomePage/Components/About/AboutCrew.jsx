import { motion } from 'framer-motion';
import AsyncState from '@/ui/feedback/AsyncState';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import defaultAvatar from '@/assets/images/avatar-placeholder.webp';
import { crewFromClasses, revealGroup, revealItem } from './aboutHelpers';
import ChapterHead from './ChapterHead';

const TONES = ['rose', 'amber', 'violet', 'teal', 'sky', 'coral'];

// 04 · The instructors, all Oops! Crew members, as crew posters: the name in outline behind a
// cut-out photo, and the styles they teach. Real people from the public class list.
const AboutCrew = ({ classes }) => {
    const { t, tn } = useI18n();
    const crew = crewFromClasses(classes.data ?? []);

    return (
        <section className="abSection abCrew" aria-labelledby="crew-title">
            <div className="abWrap">
                <ChapterHead
                    id="crew-title"
                    number="04"
                    eyebrow={t('The crew')}
                    title={t('Taught by the people who perform it')}
                    intro={
                        crew.length > 0
                            ? tn(
                                  crew.length,
                                  'Every instructor at the studio is a member of Oops! Crew. Meet the {count} dancer you’ll be learning from.',
                                  'Every instructor at the studio is a member of Oops! Crew. Meet the {count} dancers you’ll be learning from.'
                              )
                            : t('Every instructor at the studio is a member of Oops! Crew.')
                    }
                />

                <AsyncState state={classes} emptyText="Our instructors will be introduced soon.">
                    {() => (
                        <motion.ul className="abCrewList" {...revealGroup}>
                            {crew.map((member, index) => (
                                <motion.li key={member.name} className={`abCrewCard tone-${TONES[index % TONES.length]}`} {...revealItem}>
                                    <div className="abCrewPhoto">
                                        <span className="abCrewBackName" aria-hidden="true">
                                            {member.name}
                                        </span>
                                        <span className="abCrewDisc" aria-hidden="true" />
                                        {/* The name is right below, so the photo needs no alt text of its own. */}
                                        <img src={avatarUrl(member.avatarPath) ?? defaultAvatar} alt="" loading="lazy" />
                                    </div>
                                    <div className="abCrewInfo">
                                        <h3>{member.name}</h3>
                                        <ul aria-label={t('Teaches')}>
                                            {member.styles.map((style) => (
                                                <li key={style.label}>{style.isKey ? t(style.label) : style.label}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </motion.li>
                            ))}
                        </motion.ul>
                    )}
                </AsyncState>
            </div>
        </section>
    );
};

export default AboutCrew;
