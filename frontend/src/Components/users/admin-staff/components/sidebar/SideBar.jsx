import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LuHelpCircle, LuLogOut, LuX } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import LogoutButton from '../../../../Logout/LogoutButton';
import { ADMIN_NAV, findAdminPage } from '../../adminPages';
import { useStaffTasks } from '../../tasks/staffTasks';
import logoMark from '@/assets/images/logo-mark.webp';

// On wide screens the sidebar is always shown; below 1024px it slides in as a drawer (`open`).
const SideBar = ({ open, onClose }) => {
    const { role } = useAuth();
    const current = findAdminPage(useLocation().pathname);
    const badges = useStaffTasks().data?.counts ?? {};
    const sections = ADMIN_NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) => !item.adminOnly || role === ROLES.admin),
    }));

    return (
        <>
            <div className={`adminBackdrop${open ? ' isOpen' : ''}`} onClick={onClose} aria-hidden="true" />
            <aside className={`sideBar adminSidebar${open ? ' isOpen' : ''}`} aria-label="Admin menu">
                <div className="sidebarBrand">
                    <Link to="/home" className="brandLink" title="Go to the homepage">
                        <span className="brandMark">
                            <img src={logoMark} alt="" />
                        </span>
                        <span className="brandText">
                            <strong>Oops! Dance</strong>
                            <small>{role === ROLES.admin ? 'Admin' : 'Staff'} workspace</small>
                        </span>
                    </Link>
                    <button type="button" className="iconButton sidebarClose" onClick={onClose} aria-label="Close menu">
                        <LuX />
                    </button>
                </div>

                <nav className="sidebarNav">
                    {sections.map((section) => (
                        <div className="navGroup" key={section.group}>
                            <span className="navGroupLabel">{section.group}</span>
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
                                                <span className="navLabel">{label}</span>
                                                {badges[to] > 0 && (
                                                    <span className="navBadge" aria-label={`${badges[to]} to do`}>
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
                            <strong>Need a hand?</strong>
                            <small>Email the studio team</small>
                        </span>
                    </a>
                    <LogoutButton className="logoutBtn">
                        <LuLogOut aria-hidden="true" />
                        <span>Log Out</span>
                    </LogoutButton>
                </div>
            </aside>
        </>
    );
};

export default SideBar;
