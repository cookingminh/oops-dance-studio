import { useEffect, useMemo, useState } from 'react';
import { I18nContext } from './i18nContext';
import { LANGUAGES, createI18n } from './translate';

const STORAGE_KEY = 'oops-lang';

// Saved choice, else the browser's language (Vietnamese browsers start in Vietnamese).
function initialLanguage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (LANGUAGES.includes(saved)) return saved;
    } catch {
        // storage blocked: fall through
    }
    return typeof navigator !== 'undefined' && /^vi\b/i.test(navigator.language ?? '') ? 'vi' : 'en';
}

export function I18nProvider({ children }) {
    const [lang, setLangState] = useState(initialLanguage);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    const value = useMemo(() => {
        const setLang = (next) => {
            if (!LANGUAGES.includes(next)) return;
            setLangState(next);
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch {
                // not persisted; still switches for this visit
            }
        };
        return createI18n(lang, setLang);
    }, [lang]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
