import { useState } from 'react';
import { LuArrowBigUpDash, LuCheckCircle2, LuEye, LuEyeOff, LuInfo, LuLock } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
// The same scale as the password card in the profile settings.
import { passwordStrength } from '@/Components/users/admin-staff/components/body/settings/settingsModel';
import AuthInput from './AuthInput';

// A password field with a show / hide toggle and a "Caps Lock is on" note while it is.
// - `rule` (text + whether it is met) shows under it;
// - `strength` adds a strength meter (a hint for new passwords, not a rule);
// - `aside` sits on the right under it ("Forgot your password?").
// The toggle is named by hidden text, not aria-label, and the meter has no label of its own, so
// getByLabel('Password') still finds only the input.
const PasswordInput = ({ rule, strength = false, aside, ...props }) => {
    const { t } = useI18n();
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    const RuleIcon = rule?.met ? LuCheckCircle2 : LuInfo;

    // null while empty, else level 0 (too short) to 4 (strong); "too short" shows as one red bar.
    const rating = strength ? passwordStrength(props.value ?? '') : null;
    const level = rating ? Math.max(1, rating.level) : 0;
    const strengthId = `${props.id}-strength`;
    const readCapsLock = (event) => setCapsLock(Boolean(event.getModifierState?.('CapsLock')));

    return (
        <AuthInput
            icon={LuLock}
            {...props}
            type={visible ? 'text' : 'password'}
            onKeyDown={readCapsLock}
            onKeyUp={readCapsLock}
            onBlur={() => setCapsLock(false)}
            describedBy={rating ? strengthId : undefined}
            hint={rule && (
                <>
                    <RuleIcon aria-hidden="true" /> {rule.text}
                </>
            )}
            hintMet={Boolean(rule?.met)}
            meter={strength && (
                <span className="authStrengthBars" data-level={level} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                </span>
            )}
            note={
                <span className="authCaps" aria-live="polite">
                    {capsLock && (
                        <>
                            <LuArrowBigUpDash aria-hidden="true" /> {t('Caps Lock is on')}
                        </>
                    )}
                </span>
            }
            aside={aside ?? (rating && (
                <span id={strengthId} className="authStrengthText" data-level={level}>
                    <span className="sr-only">{t('Strength:')} </span>
                    {t(rating.label)}
                </span>
            ))}
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
