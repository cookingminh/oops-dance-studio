import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import './PageHeader.scss';

const EASE = [0.22, 1, 0.36, 1];
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } };
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };
const pop = { hidden: { opacity: 0, y: 12, scale: 0.94 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } } };

// Compact header for the public pages under the fixed navbar: eyebrow, title, a one-line pitch,
// quick-jump chips to the page's sections and a few live facts. Texts arrive translated.
// `overlap` leaves room for the first section to ride up over the header's bottom edge.
const PageHeader = ({ icon: Icon, eyebrow, title, pitch, links = [], facts = [], watermark, overlap = false }) => {
    const { t } = useI18n();
    return (
        <header className={`pubPageHead${overlap ? ' isOverlap' : ''}`}>
            {watermark && (
                <span className="pubPageWatermark" aria-hidden="true">
                    {watermark}
                </span>
            )}
            <div className="pubPageHeadInner">
                <motion.div className="pubPageHeadText" variants={stagger} initial="hidden" animate="show">
                    <motion.span className="pubPageEyebrow" variants={rise}>
                        {Icon && <Icon aria-hidden="true" />} {eyebrow}
                    </motion.span>
                    <motion.h1 variants={rise}>{title}</motion.h1>
                    <motion.p variants={rise}>{pitch}</motion.p>
                    {links.length > 0 && (
                        <motion.nav className="pubPageJump" variants={rise} aria-label={t('On this page')}>
                            {links.map(({ id, label, icon: LinkIcon }) => (
                                <a key={id} href={`#${id}`}>
                                    {LinkIcon && <LinkIcon aria-hidden="true" />}
                                    {label}
                                </a>
                            ))}
                        </motion.nav>
                    )}
                </motion.div>

                {facts.length > 0 && (
                    <motion.dl className="pubPageFacts" variants={stagger} initial="hidden" animate="show">
                        {facts.map((fact) => (
                            <motion.div key={fact.label} variants={pop}>
                                <dt>{fact.label}</dt>
                                <dd>{fact.value}</dd>
                            </motion.div>
                        ))}
                    </motion.dl>
                )}
            </div>
        </header>
    );
};

export default PageHeader;
