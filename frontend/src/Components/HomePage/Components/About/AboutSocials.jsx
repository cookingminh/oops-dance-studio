import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { LuArrowRight, LuArrowUpRight, LuMail } from 'react-icons/lu';
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube } from 'react-icons/si';
import { sections, socials } from '@/content/about';
import { useI18n } from '@/i18n/i18nContext';
import { reveal, stagger, staggerItem, useLocalize } from './aboutHelpers';

const ICONS = { facebook: SiFacebook, youtube: SiYoutube, instagram: SiInstagram, tiktok: SiTiktok };

// Closing: the crew's channels as big tiles (each fills with its brand colour on hover), the email,
// then the way into a class.
const AboutSocials = () => {
    const L = useLocalize();
    const { t } = useI18n();
    const reduce = useReducedMotion();
    const networks = socials.filter((social) => ICONS[social.id]);
    const email = socials.find((social) => social.id === 'email');
    const { cta } = sections;

    return (
        <>
            <section className="abSection abSocialsSection" aria-labelledby="socials-title">
                <div className="abWrap">
                    <motion.h2 id="socials-title" className="abTitle" {...reveal(reduce)}>
                        {L(sections.socials.title)}
                    </motion.h2>
                    <motion.ul className="abSocials" {...stagger(reduce, 0.07)}>
                        {networks.map((social) => {
                            const Icon = ICONS[social.id];
                            return (
                                <motion.li key={social.id} {...(reduce ? {} : staggerItem)}>
                                    <a className={`abSocial is-${social.id}`} href={social.url} target="_blank" rel="noopener noreferrer">
                                        <Icon className="abSocialIcon" aria-hidden="true" />
                                        <span className="abSocialText">
                                            <strong>{social.name}</strong>
                                            <small>{social.handle}</small>
                                        </span>
                                        <LuArrowUpRight className="abSocialArrow" aria-hidden="true" />
                                        <span className="sr-only"> {t('(opens in a new tab)')}</span>
                                    </a>
                                </motion.li>
                            );
                        })}
                    </motion.ul>
                    {email && (
                        <motion.p className="abEmail" {...reveal(reduce, { y: 12 })}>
                            <LuMail aria-hidden="true" />
                            <a href={email.url}>{email.handle}</a>
                        </motion.p>
                    )}
                </div>
            </section>

            <section className="abSection abCtaSection" aria-labelledby="cta-title">
                <div className="abWrap">
                    <motion.div className={`abCta${cta.image ? ' hasPhoto' : ''}`} {...reveal(reduce, { y: 36, duration: 0.7 })}>
                        <div className="abCtaText">
                            <h2 id="cta-title">{L(cta.title)}</h2>
                            <p>{L(cta.text)}</p>
                            <Link to={cta.link} className="abBtn isLight">
                                {L(cta.button)} <LuArrowRight aria-hidden="true" />
                            </Link>
                        </div>
                        {cta.image && (
                            <div className="abCtaPhoto" aria-hidden="true">
                                <img src={cta.image} alt="" width="1600" height="1067" loading="lazy" decoding="async" />
                            </div>
                        )}
                    </motion.div>
                </div>
            </section>
        </>
    );
};

export default AboutSocials;
