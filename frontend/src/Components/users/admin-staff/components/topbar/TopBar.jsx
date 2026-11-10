import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { LuCalendarDays, LuMenu } from 'react-icons/lu';
import { useAuth } from '@/auth/useAuth';
import { useRoleLabel } from '@/hooks/useRoleLabel';
import { studioDateLabel } from '@/lib/format';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import LanguageSwitch from '@/ui/LanguageSwitch';
import { useI18n } from '@/i18n/i18nContext';

// Workspace top bar, shared by /admin and /profile: the current page's title and description,
// optional `actions` (the staff to-do bell), today's date and who is signed in (which opens
// `settingsPath`).
const TopBar = ({ onOpenMenu, findPage, settingsPath, actions = null }) => {
    const { user } = useAuth();
    const { t, intl } = useI18n();
    const roleLabel = useRoleLabel();
    const { pathname } = useLocation();
    const page = findPage(pathname);
    const name = user.full_name || user.username;

    return (
        <header className="adminTopBar">
            <button type="button" className="iconButton menuToggle" onClick={onOpenMenu} aria-label={t('Open menu')}>
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
                        <h1>{t(page.label)}</h1>
                        <p>{t(page.description)}</p>
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="topBarRight">
                <LanguageSwitch />
                {actions}
                <span className="datePill">
                    <LuCalendarDays aria-hidden="true" />
                    {studioDateLabel(intl)}
                </span>
                <Link to={settingsPath} className="userChip" title={t('Profile settings')}>
                    <Avatar {...AVATAR_DEFAULTS} size="sm" src={user.avatar_url ?? undefined} name={name} />
                    <span className="userMeta">
                        <strong>{name}</strong>
                        <small>{t(roleLabel)}</small>
                    </span>
                </Link>
            </div>
        </header>
    );
};

export default TopBar;
