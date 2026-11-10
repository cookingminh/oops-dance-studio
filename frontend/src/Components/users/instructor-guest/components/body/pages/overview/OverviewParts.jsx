import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuArrowUpRight } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { studioDateLabel } from '@/lib/format';
import CountUp from '../../../../../admin-staff/components/common/CountUp';
import { fadeUp, stagger } from '../../../../../admin-staff/components/common/motion';
import { ClassThumb, DayName, StartsIn } from '../classes/ClassParts';
import video from '@/assets/video/dashboard.mp4';
import poster from '@/assets/images/studio.webp';

// Greeting over the studio video, the next session and shortcuts.
// `actions` labels are English source text, translated here.
export const Hero = ({ title, summary, upNext, actions }) => {
    const { t, intl } = useI18n();
    return (
        <motion.section variants={fadeUp} className="pfHero">
            <video className="pfHeroVideo" src={video} poster={poster} autoPlay muted loop playsInline aria-hidden="true" />
            <div className="pfHeroShade" aria-hidden="true" />
            <div className="pfHeroContent">
                <span className="pfHeroDate">{studioDateLabel(intl)}</span>
                <h2>{title}</h2>
                {summary && <p>{summary}</p>}
                {upNext}
                <div className="pfHeroActions">
                    {actions.map(({ to, label, icon: Icon }, index) => (
                        <Link key={to} to={to} className={`pfHeroBtn${index === 0 ? ' isPrimary' : ''}`}>
                            <Icon aria-hidden="true" /> {t(label)}
                        </Link>
                    ))}
                </div>
            </div>
        </motion.section>
    );
};

// The next session as a frosted strip inside the hero.
export const UpNext = ({ session, today, room }) => {
    const { t } = useI18n();
    return (
        <div className={`pfUpNext${session.isLive ? ' isLive' : ''}`}>
            <ClassThumb cls={session.cls} />
            <span className="pfUpNextText">
                <small>{session.isLive ? t('Happening now') : t('Up next')}</small>
                <strong>{session.cls.name}</strong>
                <span>
                    <DayName date={session.date} today={today} style="weekday" /> · {session.start}–{session.end}
                    {room && ` · ${room}`}
                </span>
            </span>
            {!session.isLive && (
                <span className="pfUpNextWhen">
                    <StartsIn session={session} today={today} />
                </span>
            )}
        </div>
    );
};

// "My Stats": cards that count up once loaded; a card with `to` opens that page.
export const StatGrid = ({ state, stats, link }) => {
    const { t } = useI18n();
    return (
        <motion.section variants={fadeUp} className="pfStats" aria-labelledby="my-stats-title">
            <div className="pfStatsHead">
                <h2 id="my-stats-title">{t('My Stats')}</h2>
                {link}
            </div>
            <motion.div className="pfStatGrid" variants={stagger}>
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    let value = <span className="pfSkeleton">…</span>;
                    if (state.error) value = '—';
                    else if (state.data) value = stat.value === null ? '—' : <CountUp value={stat.value} format={stat.format} />;
                    const body = (
                        <>
                            <span className="pfStatTop">
                                <span className="pfStatIcon" aria-hidden="true">
                                    <Icon />
                                </span>
                                {stat.to && <LuArrowUpRight className="pfStatGo" aria-hidden="true" />}
                            </span>
                            <span className="pfStatValue">{value}</span>
                            <span className="pfStatLabel">{t(stat.label)}</span>
                            {stat.hint && <span className="pfStatHint">{stat.hint}</span>}
                        </>
                    );
                    return (
                        <motion.div variants={fadeUp} key={stat.label} className={`pfStat tone-${stat.tone}`}>
                            {stat.to ? (
                                <Link to={stat.to} className="pfStatInner">
                                    {body}
                                </Link>
                            ) : (
                                <div className="pfStatInner">{body}</div>
                            )}
                        </motion.div>
                    );
                })}
            </motion.div>
        </motion.section>
    );
};
