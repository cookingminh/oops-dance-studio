import { useMemo } from 'react';
import { LuCheck, LuLanguages } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';

// Each language is named in itself and shows today's date the way that language writes it,
// so the choice reads the same whichever language the page is in (like the top-bar switch).
const LANGUAGES = [
    { key: 'en', code: 'EN', name: 'English', intl: 'en-GB' },
    { key: 'vi', code: 'VI', name: 'Tiếng Việt', intl: 'vi-VN' },
];

const sampleDate = (intl) => new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

// Language for this device: applies at once, no save needed.
const PreferencesCard = () => {
    const { t, lang, setLang } = useI18n();
    const samples = useMemo(() => Object.fromEntries(LANGUAGES.map((option) => [option.key, sampleDate(option.intl)])), []);

    return (
        <SectionCard
            id="settings-preferences"
            tabIndex={-1}
            icon={LuLanguages}
            title={t('Preferences')}
            subtitle={t('Changes apply right away on this device.')}
        >
            <div className="prefRow">
                <div className="prefText" id="settings-language-label">
                    <strong>{t('Language')}</strong>
                    <span>{t('Menus, dates and messages.')}</span>
                </div>
                <div className="langChoice" role="radiogroup" aria-labelledby="settings-language-label">
                    {LANGUAGES.map((option) => {
                        const selected = lang === option.key;
                        return (
                            <label key={option.key} className={`langOption${selected ? ' isSelected' : ''}`} lang={option.key}>
                                <input type="radio" name="settings-language" value={option.key} checked={selected} onChange={() => setLang(option.key)} />
                                <span className="langCode" aria-hidden="true">
                                    {option.code}
                                </span>
                                <span className="langText">
                                    <strong>{option.name}</strong>
                                    <small>{samples[option.key]}</small>
                                </span>
                                <LuCheck className="langCheck" aria-hidden="true" />
                            </label>
                        );
                    })}
                </div>
            </div>
        </SectionCard>
    );
};

export default PreferencesCard;
