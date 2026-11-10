import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import { fadeUp } from '../../common/motion';
import { SECTIONS } from './settingsModel';

// "On this page" list beside the sections (desktop only). The current section is highlighted as
// you scroll; a dot marks sections with unsaved changes.
const SectionNav = ({ active, unsaved, onJump }) => {
    const { t } = useI18n();

    return (
        <motion.nav variants={fadeUp} className="settingsNav" aria-labelledby="settings-nav-label">
            <span id="settings-nav-label" className="settingsNavLabel">
                {t('On this page')}
            </span>
            <ul>
                {SECTIONS.map(({ id, label, icon: Icon }) => {
                    const isActive = active === id;
                    return (
                        <li key={id}>
                            <a
                                href={`#${id}`}
                                className={isActive ? 'isActive' : undefined}
                                aria-current={isActive ? 'location' : undefined}
                                onClick={(event) => {
                                    event.preventDefault();
                                    onJump(id);
                                }}
                            >
                                {isActive && <motion.span layoutId="settingsNavPill" className="navPill" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
                                <Icon aria-hidden="true" className="navIcon" />
                                <span className="navLabel">{t(label)}</span>
                                {unsaved.has(id) && (
                                    <span className="unsavedDot" title={t('Unsaved changes')}>
                                        <span className="sr-only">{t('Unsaved changes')}</span>
                                    </span>
                                )}
                            </a>
                        </li>
                    );
                })}
            </ul>
        </motion.nav>
    );
};

export default SectionNav;
