import { motion, useReducedMotion } from 'framer-motion';
import { crew, sections } from '@/content/about';
import { reveal, stagger, staggerItem, useLocalize } from './aboutHelpers';

// Meet our crew: every member's portrait with their name on a red bar, like the crew's own poster.
const AboutCrew = () => {
    const L = useLocalize();
    const reduce = useReducedMotion();
    if (!crew.length) return null;
    const { crew: copy } = sections;

    return (
        <section className="abSection abCrew" aria-labelledby="crew-title">
            <div className="abWrap">
                <div className="abCrewHead">
                    <motion.h2 id="crew-title" className="abTitle" {...reveal(reduce)}>
                        {L(copy.title)}
                    </motion.h2>
                    <motion.p className="abCrewEdition" {...reveal(reduce, { delay: 0.1 })}>
                        <strong>{copy.edition}</strong> · {crew.length} {L(copy.members)}
                    </motion.p>
                </div>

                <motion.ul className="abCrewGrid" {...stagger(reduce, 0.045)}>
                    {crew.map((member) => (
                        <motion.li key={member.id} className="abMember" {...(reduce ? {} : staggerItem)}>
                            <figure>
                                <span className="abMemberPhoto">
                                    {member.photo && <img src={member.photo} alt="" width="281" height="300" loading="lazy" decoding="async" />}
                                </span>
                                <figcaption>{member.name}</figcaption>
                            </figure>
                        </motion.li>
                    ))}
                </motion.ul>
            </div>
        </section>
    );
};

export default AboutCrew;
