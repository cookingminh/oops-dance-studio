import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/i18nContext';
import './languageSwitch.scss';

const OPTIONS = [
    { key: 'en', label: 'EN', name: 'English' },
    { key: 'vi', label: 'VI', name: 'Tiếng Việt' },
];

// EN | VI toggle. `tone="dark"` for use on photos or coloured bars.
const LanguageSwitch = ({ tone = 'light', className = '' }) => {
    const { lang, setLang, t } = useI18n();
    return (
        <div className={`langSwitch tone-${tone} ${className}`} role="group" aria-label={t('Language')}>
            {OPTIONS.map((option) => (
                <button
                    key={option.key}
                    type="button"
                    lang={option.key}
                    title={option.name}
                    aria-label={option.name}
                    aria-pressed={lang === option.key}
                    onClick={() => setLang(option.key)}
                >
                    {lang === option.key && (
                        <motion.span layoutId={`langPill-${tone}`} className="langPill" transition={{ type: 'spring', bounce: 0, duration: 0.3 }} />
                    )}
                    <span className="langLabel">{option.label}</span>
                </button>
            ))}
        </div>
    );
};

export default LanguageSwitch;
