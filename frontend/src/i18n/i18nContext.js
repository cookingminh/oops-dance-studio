import { createContext, useContext } from 'react';
import { createI18n } from './translate';

// English until the provider mounts (e.g. in isolated components).
export const I18nContext = createContext(createI18n('en'));

// { lang, setLang, t, tn, formatDate, dayName, monthName, intl, dateLocale }
export const useI18n = () => useContext(I18nContext);
