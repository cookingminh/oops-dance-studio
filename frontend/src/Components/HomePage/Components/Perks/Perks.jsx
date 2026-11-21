import { Link } from 'react-router-dom';
import { LuArrowRight, LuClapperboard, LuGift, LuHeartHandshake, LuMessageCircle, LuMusic, LuPhone, LuStar } from 'react-icons/lu';
import crewShoot from '@/assets/images/crew-shoot.webp';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useI18n } from '@/i18n/i18nContext';
import { PHONE } from '../NavBar/contactInfo';
import { usePublicChrome } from '../NavBar/publicChrome';

// Why students join: the end-of-course shoot (a still of the crew, text over the dark ceiling so
// the faces and the dog stay clear), Oops! Crew coaches, step-by-step teaching and a free first
// class. Desktop: the photo on the left, the other three in two rows beside it.
const Perks = () => {
    const { t } = useI18n();
    const { isAuthenticated } = useAuth();

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
                <article className="perk isPhoto" data-aos="fade-up">
                    <img
                        className="perkPhoto"
                        src={crewShoot}
                        alt={t('Oops! Crew in silver outfits striking a pose in the studio, with the studio dog in an Oops! T-shirt')}
                        width="1600"
                        height="1090"
                        loading="lazy"
                        decoding="async"
                    />
                    <div className="perkPhotoShade" aria-hidden="true" />
                    <div className="perkPhotoText">
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

                <article className="perk isTrial" data-aos="fade-up" data-aos-delay="180">
                    <div className="perkTrialHead">
                        <span className="perkIcon" aria-hidden="true">
                            <LuGift />
                        </span>
                        <div>
                            <span className="perkTrialTag">{t('For first-timers')}</span>
                            <h3>{t('Your first class is free')}</h3>
                        </div>
                    </div>
                    <p>{t('New to Oops!? Sign up and try any class you like, on us. Meet the coach, learn the moves, feel the vibe.')}</p>
                    <Link to={isAuthenticated ? '/classes' : '/register'} className="perkTrialBtn">
                        {isAuthenticated ? t('Explore classes') : t('Claim my free class')} <LuArrowRight aria-hidden="true" />
                    </Link>
                </article>
            </div>
        </section>
    );
};

// Closing call to action. Visitors get the free first class; students are sent to pick a class and ask to join it
// from its card (the studio approves), with a message or a call as the other ways in; other members (instructors,
// staff) are asked to get in touch.
export const JoinBanner = () => {
    const { t } = useI18n();
    const { isAuthenticated, role } = useAuth();
    const { openContact } = usePublicChrome();
    const isStudent = isAuthenticated && role === ROLES.guest;

    let pitch = t('Create a free account and try any class free. Dance with Oops! Crew, no experience needed.');
    if (isStudent) pitch = t('Ask to join it right from its card on the classes page. The studio gets back to you, usually within a day.');
    else if (isAuthenticated) pitch = t('Call or message us and we’ll save you a spot in its next session.');

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
                    <p>{pitch}</p>
                </div>
                <div className="hpJoinActions">
                    {isStudent && (
                        <Link to="/classes#all-classes" className="hpJoinBtn isPrimary">
                            {t('Pick a class')} <LuArrowRight aria-hidden="true" />
                        </Link>
                    )}
                    {isAuthenticated && (
                        <button type="button" className={`hpJoinBtn${isStudent ? '' : ' isPrimary'}`} onClick={openContact}>
                            <LuMessageCircle aria-hidden="true" /> {t('Message us')}
                        </button>
                    )}
                    {!isAuthenticated && (
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
