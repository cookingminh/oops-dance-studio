import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight, LuArrowUpRight, LuFacebook, LuGift, LuInstagram, LuMapPin, LuYoutube } from 'react-icons/lu';
import { SiTiktok } from 'react-icons/si';
import { useI18n } from '@/i18n/i18nContext';
import { ADDRESS, MAP_URL, SOCIALS } from './aboutContent';
import { reveal } from './aboutHelpers';

const ICONS = { facebook: LuFacebook, tiktok: SiTiktok, instagram: LuInstagram, youtube: LuYoutube };

// Closing spread: try a class for free, find the studio, follow the crew.
const AboutJoin = () => {
    const { t } = useI18n();
    const newTab = <span className="sr-only"> {t('(opens in a new tab)')}</span>;

    return (
        <section className="abSection abJoin" aria-labelledby="join-title">
            <div className="abWrap">
                <motion.div className="abJoinCard" {...reveal}>
                    <div className="abJoinMain">
                        <span className="abJoinTag">
                            <LuGift aria-hidden="true" /> {t('Your first class is free')}
                        </span>
                        <h2 id="join-title">{t('Come dance with us')}</h2>
                        <p>{t('Pick any class on the timetable and try it on us. No experience needed: bring comfy shoes, water and a friend if you like.')}</p>
                        <div className="abJoinActions">
                            <Link to="/classes" className="abBtn isLight">
                                {t('Find your free class')} <LuArrowRight aria-hidden="true" />
                            </Link>
                            <a href={MAP_URL} target="_blank" rel="noreferrer" className="abJoinMap">
                                <LuMapPin aria-hidden="true" />
                                <span>{t(ADDRESS)}</span>
                                {newTab}
                            </a>
                        </div>
                    </div>

                    <div className="abJoinSocial">
                        <h3>{t('Follow the crew')}</h3>
                        <ul>
                            {SOCIALS.map((social) => {
                                const Icon = ICONS[social.network];
                                return (
                                    <li key={social.network}>
                                        <a href={social.url} target="_blank" rel="noreferrer" className={`abSocial is-${social.network}`}>
                                            <span className="abSocialIcon" aria-hidden="true">
                                                <Icon />
                                            </span>
                                            <span className="abSocialText">
                                                <strong>{social.name}</strong>
                                                <small>{social.handle}</small>
                                            </span>
                                            <LuArrowUpRight className="abSocialArrow" aria-hidden="true" />
                                            {newTab}
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default AboutJoin;
