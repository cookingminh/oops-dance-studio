import { LuAlarmClock } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import './checkins.scss';

// "Late check-out" pill: the instructor checked out more than 10 minutes after the session ended (or staff
// marked it so). Shown wherever check-ins show; the word is always there, so colour is never the only signal.
const LateTag = ({ className = '' }) => {
    const { t } = useI18n();
    return (
        <span className={`ckLateTag ${className}`}>
            <LuAlarmClock aria-hidden="true" />
            {t('Late check-out')}
        </span>
    );
};

export default LateTag;
