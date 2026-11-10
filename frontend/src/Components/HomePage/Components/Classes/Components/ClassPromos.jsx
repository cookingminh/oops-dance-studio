import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowRight, LuCalendarDays, LuClapperboard, LuPlay } from 'react-icons/lu';
import { SiYoutube } from 'react-icons/si';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { avatarUrl } from '@/services/storage';
import { clipLength, promoOf } from '@/services/promos';
import PromoDialog from '@/ui/promo/PromoDialog';
import './ClassPromos.scss';

const EASE = [0.22, 1, 0.36, 1];
const row = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const card = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };
const hueOf = (id) => (Number(id) * 47) % 360;

// /classes: each class's next routine as its coach filmed it (routine promos, services/promos.js) —
// upright cards in a row that scrolls sideways; a card plays its clip in a dialog with the way in.
// `promos` is listUpcomingPromos() data, `classes` the public class list. Nothing at all without promos.
const ClassPromos = ({ promos, classes }) => {
    const { t, formatDate } = useI18n();
    const { isAuthenticated } = useAuth();
    const [playing, setPlaying] = useState(null);

    const list = useMemo(() => {
        if (!promos?.promos || !classes) return [];
        const byId = new Map(classes.map((cls) => [cls.id, cls]));
        return promos.promos
            .filter((row) => byId.has(row.class_id))
            .map((row) => ({ ...row, cls: byId.get(row.class_id), promo: promoOf(row), started: row.starts_on < promos.today }));
    }, [promos, classes]);
    if (list.length === 0) return null;

    const when = (item) =>
        item.started ? t('Started {date}', { date: formatDate(item.starts_on, 'short') }) : t('Starts {date}', { date: formatDate(item.starts_on, 'short') });

    const seeClass = (item) => {
        setPlaying(null);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.getElementById(`class-${item.class_id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    };

    return (
        <section id="next-routines" className="hpPromos">
            <header className="hpSectionHead" data-aos="fade-up">
                <div>
                    <span className="hpEyebrow">{t('Coming next')}</span>
                    <h2>{t('Next routines, from the coaches')}</h2>
                    <p>{t('Every coach films a short clip of the routine their class learns next. Join before it starts and learn it from the very first session.')}</p>
                </div>
            </header>

            <motion.ul className="hpPromoRow" variants={row} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
                {list.map((item) => (
                    <motion.li key={item.id} variants={card}>
                        <button
                            type="button"
                            className="hpPromoCard"
                            style={{ '--hue': hueOf(item.class_id) }}
                            onClick={() => setPlaying(item)}
                            aria-label={t('Play the promo of {name}: {title}', { name: item.cls.name, title: item.title })}
                        >
                            {item.promo.poster ? (
                                <img src={item.promo.poster} alt="" loading="lazy" decoding="async" />
                            ) : (
                                <span className="hpPromoArt" aria-hidden="true">
                                    <LuClapperboard />
                                </span>
                            )}
                            <span className="hpPromoShade" aria-hidden="true" />
                            <span className="hpPromoTop">
                                <span className={`hpPromoWhen${item.started ? ' isStarted' : ''}`}>
                                    <LuCalendarDays aria-hidden="true" /> {when(item)}
                                </span>
                                {item.promo.ytId ? (
                                    <span className="hpPromoTime isYoutube">
                                        <SiYoutube aria-hidden="true" />
                                    </span>
                                ) : item.promo.seconds ? (
                                    <span className="hpPromoTime">{clipLength(item.promo.seconds)}</span>
                                ) : null}
                            </span>
                            <span className="hpPromoPlay" aria-hidden="true">
                                <LuPlay />
                            </span>
                            <span className="hpPromoText">
                                <strong>{item.title}</strong>
                                <span className="hpPromoClass">{item.cls.name}</span>
                                <span className="hpPromoCoach">
                                    {item.cls.instructor_avatar_path && <img src={avatarUrl(item.cls.instructor_avatar_path)} alt="" />}
                                    {item.cls.instructor_name}
                                </span>
                            </span>
                        </button>
                    </motion.li>
                ))}
            </motion.ul>

            {playing && (
                <PromoDialog
                    promo={playing.promo}
                    portalClass="hpPromoDialog"
                    eyebrow={`${t('Coming next')} · ${playing.cls.name}`}
                    title={playing.title}
                    meta={t('{when} · with {teacher}', { when: when(playing), teacher: playing.cls.instructor_name })}
                    onClose={() => setPlaying(null)}
                    footer={
                        <>
                            <button type="button" className="hpPromoBtn" onClick={() => seeClass(playing)}>
                                {t('See the class')}
                            </button>
                            {!isAuthenticated && (
                                <Link to="/register" className="hpPromoBtn isPrimary">
                                    {t('Claim my free class')} <LuArrowRight aria-hidden="true" />
                                </Link>
                            )}
                        </>
                    }
                />
            )}
        </section>
    );
};

export default ClassPromos;
