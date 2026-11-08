import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { LuCalendarDays, LuMenu } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { studioDateLabel } from '@/lib/format';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { findAdminPage } from '../../adminPages';
import TaskBell from './TaskBell';

// Sticky header: the current page's title and description, today's date and who is signed in
// (which opens their profile settings).
const TopBar = ({ onOpenMenu }) => {
    const { user, role } = useAuth();
    const { pathname } = useLocation();
    const page = findAdminPage(pathname);
    const name = user.full_name || user.username;

    return (
        <header className="adminTopBar">
            <button type="button" className="iconButton menuToggle" onClick={onOpenMenu} aria-label="Open menu">
                <LuMenu />
            </button>

            <div className="topBarTitle">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={page.to}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        <h1>{page.label}</h1>
                        <p>{page.description}</p>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="topBarRight">
                <TaskBell />
                <span className="datePill">
                    <LuCalendarDays aria-hidden="true" />
                    {studioDateLabel()}
                </span>
                <Link to="/admin/settings" className="userChip" title="Profile settings">
                    <Avatar {...AVATAR_DEFAULTS} size="sm" src={user.avatar_url ?? undefined} name={name} />
                    <span className="userMeta">
                        <strong>{name}</strong>
                        <small>{role}</small>
                    </span>
                </Link>
            </div>
        </header>
    );
};

export default TopBar;
