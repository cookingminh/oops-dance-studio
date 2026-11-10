import { Link } from 'react-router-dom';
import { LuArrowUpRight, LuClock, LuFacebook, LuInstagram, LuMapPin, LuMessageCircle, LuPhone, LuYoutube } from 'react-icons/lu';
import { SiTiktok } from 'react-icons/si';
import { useAuth } from '@/auth/useAuth';
import { DASHBOARD_ROLES, homePathFor } from '@/auth/roles';
import { useI18n } from '@/i18n/i18nContext';
import BrandMark from '../NavBar/BrandMark';
import { ADDRESS, MAP_URL, PHONE, SOCIALS } from '../NavBar/contactInfo';
import { PUBLIC_PAGES, usePublicChrome } from '../NavBar/publicChrome';
import './Footer.scss';

const SOCIAL_LINKS = [
    { key: 'facebook', label: 'Facebook', icon: LuFacebook },
    { key: 'tiktok', label: 'TikTok', icon: SiTiktok },
    { key: 'instagram', label: 'Instagram', icon: LuInstagram },
    { key: 'youtube', label: 'YouTube', icon: LuYoutube },
];

// Compact footer: the pages, how to reach the studio, and the visitor's account.
// ("Log in" rather than "Sign In": the navbar's Sign In link must stay the only one on the page.)
const Footer = () => {
    const { t } = useI18n();
    const { user, isAuthenticated } = useAuth();
    const { openContact } = usePublicChrome();
    const isStaff = DASHBOARD_ROLES.includes(user?.role);

    return (
        <footer className="pubFooter">
            <div className="pubFooterInner">
                <div className="pubFooterBrand">
                    <Link to="/home" className="pubFooterLogo" aria-label="Oops! Dance Studio">
                        <BrandMark />
                    </Link>
                    <p>{t('“Let Every Step Set You Free - Dance to Express, Not to Impress”')}</p>
                    <ul className="pubSocials">
                        {SOCIAL_LINKS.map(({ key, label, icon: Icon }) => (
                            <li key={key}>
                                <a href={SOCIALS[key]} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
                                    <Icon aria-hidden="true" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                <nav className="pubFooterCol" aria-label={t('Explore')}>
                    <h2>{t('Explore')}</h2>
                    <ul>
                        {PUBLIC_PAGES.map((page) => (
                            <li key={page.to}>
                                <Link to={page.to}>{t(page.label)}</Link>
                            </li>
                        ))}
                        <li>
                            <Link to="/classes#timetable">{t('Weekly timetable')}</Link>
                        </li>
                        <li>
                            <Link to="/rooms#book">{t('Book a room')}</Link>
                        </li>
                    </ul>
                </nav>

                <div className="pubFooterCol">
                    <h2>{t('Visit us')}</h2>
                    <ul className="pubFooterInfo">
                        <li>
                            <LuMapPin aria-hidden="true" />
                            <a href={MAP_URL} target="_blank" rel="noopener noreferrer">
                                {ADDRESS}
                            </a>
                        </li>
                        <li>
                            <LuClock aria-hidden="true" />
                            <span>{t('Rooms open every day, 08:00 – 22:00')}</span>
                        </li>
                        <li>
                            <LuPhone aria-hidden="true" />
                            <a href={PHONE.tel}>{PHONE.display}</a>
                        </li>
                    </ul>
                    <button type="button" className="pubFooterContact" onClick={openContact}>
                        <LuMessageCircle aria-hidden="true" /> {t('Contact')}
                    </button>
                </div>

                <nav className="pubFooterCol" aria-label={t('Account')}>
                    <h2>{t('Account')}</h2>
                    <ul>
                        {isAuthenticated ? (
                            <>
                                <li>
                                    <Link to={homePathFor(user?.role)}>{t(isStaff ? 'Dashboard' : 'My Profile')}</Link>
                                </li>
                                <li>
                                    <Link to={isStaff ? '/admin/bookings' : '/profile/my-bookings'}>{t('My Bookings')}</Link>
                                </li>
                            </>
                        ) : (
                            <>
                                <li>
                                    <Link to="/login">{t('Log in')}</Link>
                                </li>
                                <li>
                                    <Link to="/register">{t('Sign up')}</Link>
                                </li>
                            </>
                        )}
                    </ul>
                </nav>
            </div>

            <div className="pubFooterBottom">
                <p>
                    © {new Date().getFullYear()} Oops! Dance Studio
                </p>
                <p>
                    {t('Web Developed by')}{' '}
                    <a href="https://nminh.com" target="_blank" rel="noopener noreferrer">
                        Nminh <LuArrowUpRight aria-hidden="true" />
                    </a>
                </p>
            </div>
        </footer>
    );
};

export default Footer;
