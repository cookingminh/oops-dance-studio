import { LuCalendarPlus } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import './routines.scss';

// "Make-up" pill for a one-off session with its own times (staff attendance, instructor check-in,
// the routines panel). The word is always there, so colour is never the only signal.
const MakeUpTag = ({ className = '' }) => {
    const { t } = useI18n();
    return (
        <span className={`rtMakeUpTag ${className}`}>
            <LuCalendarPlus aria-hidden="true" />
            {t('Make-up')}
        </span>
    );
};

export default MakeUpTag;
