import { Link } from 'react-router-dom';
import { LuArrowRight, LuCalendarClock, LuClapperboard, LuDoorOpen, LuGift, LuHeartHandshake, LuMessageCircle, LuMusic, LuPhone, LuSparkles, LuStar } from 'react-icons/lu';
import video from '@/assets/video/register.mp4';
import poster from '@/assets/images/studio.webp';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { PHONE } from '../NavBar/contactInfo';
import { usePublicChrome } from '../NavBar/publicChrome';

// register.mp4 is a reel of classes posing after their monthly shoot (the hero already plays the
// studio video); loop the class photos and skip the empty-room shots around them.
const CLIP = { from: 9.2, to: 19.8 };
const keepInClip = (event) => {
    const v = event.currentTarget;
    if (v.currentTime < CLIP.from || v.currentTime > CLIP.to) v.currentTime = CLIP.from;
};

// Why students join: the monthly class video, Oops! Crew coaches, step-by-step teaching, a new
// song each month, practice rooms and a free first class. Numbers and songs come from the
// public class list.
const Perks = ({ classes }) => {
    const { t } = useI18n();
    const { isAuthenticated } = useAuth();
    const list = classes.data ?? [];
    const sessions = list.reduce((sum, item) => sum + (item.schedules ?? []).length, 0);
    const coaches = new Set(list.map((item) => item.instructor_name)).size;
    const songs = list.filter((item) => item.lesson).slice(0, 4);

    return (
        <section id="why-oops" className="hpPerks">
            <header className="hpSectionHead isCentered" data-aos="fade-up">
                <div>
                    <span className="hpEyebrow">{t('Why Oops!')}</span>
                    <h2>{t('More than a dance class')}</h2>
                    <p>{t('Learn a full routine every course, dance it with your class, and walk away with a video you’ll want to post.')}</p>
                </div>
            </header>

            <div className="perkGrid">
                <article className="perk isVideo" data-aos="fade-up">
                    <video
                        className="perkVideo"
                        src={video}
                        poster={poster}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        onLoadedMetadata={(event) => {
                            event.currentTarget.currentTime = CLIP.from;
                        }}
                        onTimeUpdate={keepInClip}
                        aria-hidden="true"
                    />
                    <div className="perkVideoShade" />
                    <div className="perkVideoText">
                        <span className="perkTag">
                            <LuClapperboard aria-hidden="true" /> {t('End-of-course shoot')}
                        </span>
                        <h3>{t('Your class, on camera, every course')}</h3>
                        <p>
                            {t('At the end of each course the whole class films the routine together: real camera work, studio lights and a clip that looks as good as it feels.')}
                        </p>
                    </div>
                </article>

                <article className="perk isCrew" data-aos="fade-up" data-aos-delay="60">
                    <span className="perkIcon" aria-hidden="true">
                        <LuStar />
                    </span>
                    <h3>{t('Coached by Oops! Crew')}</h3>
                    <p>{t('Every instructor dances with Oops! Crew, one of Hanoi’s best-known dance crews. You learn from people who perform.')}</p>
                </article>

                <article className="perk isCare" data-aos="fade-up" data-aos-delay="120">
                    <span className="perkIcon" aria-hidden="true">
                        <LuHeartHandshake />
                    </span>
                    <h3>{t('Taught step by step')}</h3>
                    <p>{t('Each move is broken down and corrected one by one, so first-timers keep up and regulars keep levelling up.')}</p>
                </article>

                <article className="perk isSongs" data-aos="fade-up" data-aos-delay="60">
                    <span className="perkIcon" aria-hidden="true">
                        <LuMusic />
                    </span>
                    <h3>{t('A new song every course')}</h3>
                    <p>{t('Fresh choreography to the tracks everyone is dancing to.')}</p>
                    {songs.length > 0 && (
                        <ul className="perkSongs" aria-label={t('Songs right now')}>
                            {songs.map((item) => (
                                <li key={item.id}>
                                    <LuSparkles aria-hidden="true" />
                                    <span>{item.lesson}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </article>

                <article className="perk isRooms" data-aos="fade-up" data-aos-delay="120">
                    <span className="perkIcon" aria-hidden="true">
                        <LuDoorOpen />
                    </span>
                    <h3>{t('Practise between classes')}</h3>
                    <p>{t('Book a mirrored studio room online whenever you want to drill the routine, every day from 08:00 to 22:00.')}</p>
                    <Link to="/rooms" className="perkLink">
                        {t('Book a room')} <LuArrowRight aria-hidden="true" />
                    </Link>
                </article>

                <article className="perk isNumbers" data-aos="fade-up" data-aos-delay="180">
                    <span className="perkIcon" aria-hidden="true">
                        <LuCalendarClock />
                    </span>
                    <dl className="perkStats">
                        <div>
                            <dt>{t('Classes')}</dt>
                            <dd>{list.length || '—'}</dd>
                        </div>
                        <div>
                            <dt>{t('Sessions a week')}</dt>
                            <dd>{sessions || '—'}</dd>
                        </div>
                        <div>
                            <dt>{t('Oops! Crew coaches')}</dt>
                            <dd>{coaches || '—'}</dd>
                        </div>
                    </dl>
                </article>

                <article className="perk isTrial" data-aos="fade-up" data-aos-delay="240">
                    <span className="perkIcon" aria-hidden="true">
                        <LuGift />
                    </span>
                    <span className="perkTrialTag">{t('For first-timers')}</span>
                    <h3>{t('Your first class is free')}</h3>
                    <p>{t('New to Oops!? Sign up and try any class you like, on us. Meet the coach, learn the moves, feel the vibe.')}</p>
                    <Link to={isAuthenticated ? '/classes' : '/register'} className="perkTrialBtn">
                        {isAuthenticated ? t('Explore classes') : t('Claim my free class')} <LuArrowRight aria-hidden="true" />
                    </Link>
                </article>
            </div>
        </section>
    );
};

// Closing call to action. Visitors get the free first class; members are asked to get in touch,
// since the studio adds students to a class.
export const JoinBanner = () => {
    const { t } = useI18n();
    const { isAuthenticated } = useAuth();
    const { openContact } = usePublicChrome();
    return (
        <section className="hpJoin" data-aos="fade-up">
            <div className="hpJoinCard">
                <span className="hpJoinGlow" aria-hidden="true" />
                <div>
                    <span className="hpJoinTag">
                        {isAuthenticated ? <LuMusic aria-hidden="true" /> : <LuGift aria-hidden="true" />}{' '}
                        {isAuthenticated ? t('Join a class') : t('Your first class is free')}
                    </span>
                    <h2>{isAuthenticated ? t('Found a class you like?') : t('Ready for your first routine on camera?')}</h2>
                    <p>
                        {isAuthenticated
                            ? t('Call or message us and we’ll save you a spot in its next session.')
                            : t('Create a free account and try any class free. Dance with Oops! Crew, no experience needed.')}
                    </p>
                </div>
                <div className="hpJoinActions">
                    {isAuthenticated ? (
                        <button type="button" className="hpJoinBtn isPrimary" onClick={openContact}>
                            <LuMessageCircle aria-hidden="true" /> {t('Message us')}
                        </button>
                    ) : (
                        <Link to="/register" className="hpJoinBtn isPrimary">
                            {t('Claim my free class')} <LuArrowRight aria-hidden="true" />
                        </Link>
                    )}
                    <a href={PHONE.tel} className="hpJoinBtn">
                        <LuPhone aria-hidden="true" /> {t('Call {phone}', { phone: PHONE.display })}
                    </a>
                </div>
            </div>
        </section>
    );
};

export default Perks;
