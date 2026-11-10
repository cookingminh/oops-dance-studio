import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuHelpCircle, LuLogOut, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import LogoutButton from '../../../../Logout/LogoutButton';
import logoMark from '@/assets/images/logo-mark.webp';

// Workspace sidebar, shared by /admin and /profile.
//   sections        [{ group, items: [{ to, label, icon }] }]
//   findPage(path)  the item to highlight for the current URL
//   badges          { [to]: count } shown next to items
// On wide screens it is always shown; below 1024px it slides in as a drawer (`open`).
const SideBar = ({ open, onClose, sections, findPage, badges = {}, workspaceLabel, ariaLabel = 'Menu' }) => {
    const { t } = useI18n();
    const current = findPage(useLocation().pathname);

    return (
        <>
            <div className={`adminBackdrop${open ? ' isOpen' : ''}`} onClick={onClose} aria-hidden="true" />
            <aside className={`sideBar adminSidebar${open ? ' isOpen' : ''}`} aria-label={t(ariaLabel)}>
                <div className="sidebarBrand">
                    <Link to="/home" className="brandLink" title={t('Go to the homepage')}>
                        <span className="brandMark">
                            <img src={logoMark} alt="" />
                        </span>
                        <span className="brandText">
                            <strong>Oops! Dance</strong>
                            <small>{t(workspaceLabel)}</small>
                        </span>
                    </Link>
                    <button type="button" className="iconButton sidebarClose" onClick={onClose} aria-label={t('Close menu')}>
                        <LuX />
                    </button>
                </div>

                <nav className="sidebarNav">
                    {sections.map((section) => (
                        <div className="navGroup" key={section.group}>
                            <span className="navGroupLabel">{t(section.group)}</span>
                            <ul>
                                {section.items.map(({ to, label, icon: Icon }) => {
                                    const isActive = current.to === to;
                                    return (
                                        <li key={to}>
                                            <Link
                                                to={to}
                                                className={`navItem${isActive ? ' active' : ''}`}
                                                aria-current={isActive ? 'page' : undefined}
                                            >
                                                {isActive && (
                                                    <motion.span
                                                        layoutId="adminNavActive"
                                                        className="navActiveBg"
                                                        transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                                                    />
                                                )}
                                                <Icon className="navIcon" aria-hidden="true" />
                                                <span className="navLabel">{t(label)}</span>
                                                {badges[to] > 0 && (
                                                    <span className="navBadge" aria-label={t('{count} to do', { count: badges[to] })}>
                                                        {badges[to] > 99 ? '99+' : badges[to]}
                                                    </span>
                                                )}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className="sidebarFooter">
                    <a className="helpCard" href="mailto:oopsdancestudio@gmail.com">
                        <LuHelpCircle className="helpIcon" aria-hidden="true" />
                        <span>
                            <strong>{t('Need a hand?')}</strong>
                            <small>{t('Email the studio team')}</small>
                        </span>
                    </a>
                    <LogoutButton className="logoutBtn">
                        <LuLogOut aria-hidden="true" />
                        <span>{t('Log Out')}</span>
                    </LogoutButton>
                </div>
            </aside>
        </>
    );
};

export default SideBar;
