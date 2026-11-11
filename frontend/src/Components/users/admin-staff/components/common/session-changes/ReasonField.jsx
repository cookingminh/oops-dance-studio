import { Input } from '@nextui-org/react';
import { CHANGE_REASONS } from '@/services/sessionChanges';
import { useI18n } from '@/i18n/i18nContext';

// Why a session is called off (the class reads it): one tap on a ready-made reason, or typed (≤ 200).
const ReasonField = ({ value, onChange, isDisabled = false }) => {
    const { t } = useI18n();
    const typed = value.trim();
    return (
        <div className="scgReason">
            <Input
                label={t('Reason')}
                isRequired
                value={value}
                onValueChange={onChange}
                maxLength={200}
                isDisabled={isDisabled}
                description={t('The class sees it in their schedule.')}
            />
            <div className="scgChips" role="group" aria-label={t('Ready-made reasons')}>
                {CHANGE_REASONS.map((key) => (
                    <button key={key} type="button" aria-pressed={typed === t(key)} disabled={isDisabled} onClick={() => onChange(t(key))}>
                        {t(key)}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ReasonField;
