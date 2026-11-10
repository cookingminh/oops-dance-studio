import { useState } from 'react';
import { LuCheckCircle2, LuEye, LuEyeOff, LuInfo, LuLock } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import AuthInput from './AuthInput';

// A password field with a show / hide toggle. `rule` (text + whether it is met) shows under it.
// The toggle is named by hidden text, not aria-label, so getByLabel('Password') still finds
// only the input.
const PasswordInput = ({ rule, ...props }) => {
    const { t } = useI18n();
    const [visible, setVisible] = useState(false);
    const RuleIcon = rule?.met ? LuCheckCircle2 : LuInfo;

    return (
        <AuthInput
            icon={LuLock}
            {...props}
            type={visible ? 'text' : 'password'}
            hint={rule && (
                <>
                    <RuleIcon aria-hidden="true" /> {rule.text}
                </>
            )}
            hintMet={Boolean(rule?.met)}
            end={
                <button
                    type="button"
                    className="authPeek"
                    aria-pressed={visible}
                    title={visible ? t('Hide password') : t('Show password')}
                    onClick={() => setVisible((shown) => !shown)}
                >
                    {visible ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
                    <span className="sr-only">{t('Show password')}</span>
                </button>
            }
        />
    );
};

export default PasswordInput;
