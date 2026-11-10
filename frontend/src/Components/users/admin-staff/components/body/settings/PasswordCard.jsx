import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input } from '@nextui-org/react';
import { LuCheck, LuCheckCircle2, LuEye, LuEyeOff, LuLock, LuShieldCheck } from 'react-icons/lu';
import { MIN_PASSWORD_LENGTH } from '@/hooks/useAccountSettings';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../common/SectionCard';
import { passwordStrength } from './settingsModel';
import { useFlash } from './settingsHooks';

// Four bars and a word (colour is never the only signal), plus one tip while it could be stronger.
const StrengthMeter = ({ password }) => {
    const { t } = useI18n();
    const strength = passwordStrength(password);
    if (!strength || strength.level === 0) return null;
    return (
        <span className={`pwStrength level-${strength.level}`}>
            <span className="pwBars" aria-hidden="true">
                {[1, 2, 3, 4].map((bar) => (
                    <span key={bar} className={bar <= strength.level ? 'isOn' : undefined} />
                ))}
            </span>
            <span className="pwWords">
                <strong>{t(strength.label)}</strong>
                {strength.tip && <> · {t(strength.tip)}</>}
            </span>
        </span>
    );
};

// Current password, then the new one twice. Locked demo accounts only see a note.
const PasswordCard = ({ password, locked }) => {
    const { t } = useI18n();
    const [show, setShow] = useState(false);
    const [changed, flashChanged] = useFlash(3000);
    const { passwords, setPassword, tooShort, mismatch } = password;
    const type = show ? 'text' : 'password';
    const matches = passwords.confirm.length > 0 && !tooShort && passwords.confirm === passwords.next;
    const incomplete = !passwords.current || !passwords.next || !passwords.confirm;

    const submit = async (event) => {
        if (await password.submit(event)) {
            setShow(false);
            flashChanged();
        }
    };

    return (
        <SectionCard
            id="settings-security"
            tabIndex={-1}
            icon={LuShieldCheck}
            title={t('Password')}
            subtitle={locked ? undefined : t('Use at least {count} characters you don’t use anywhere else.', { count: MIN_PASSWORD_LENGTH })}
        >
            {locked ? (
                <p className="lockedNote">
                    <LuLock aria-hidden="true" /> {t('The password of a shared demo account stays as it is.')}
                </p>
            ) : (
                <form onSubmit={submit}>
                    <div className="formGrid">
                        <Input
                            className="isFull"
                            label={t('Current password')}
                            type={type}
                            autoComplete="current-password"
                            isRequired
                            value={passwords.current}
                            onValueChange={setPassword('current')}
                            isInvalid={password.currentWrong}
                            errorMessage={password.currentWrong ? t('Your current password is incorrect.') : undefined}
                        />
                        <Input
                            label={t('New password')}
                            type={type}
                            autoComplete="new-password"
                            isRequired
                            value={passwords.next}
                            onValueChange={setPassword('next')}
                            isInvalid={tooShort}
                            errorMessage={tooShort ? t('At least {count} characters.', { count: MIN_PASSWORD_LENGTH }) : undefined}
                            description={<StrengthMeter password={passwords.next} />}
                        />
                        <Input
                            label={t('Confirm new password')}
                            type={type}
                            autoComplete="new-password"
                            isRequired
                            value={passwords.confirm}
                            onValueChange={setPassword('confirm')}
                            isInvalid={mismatch}
                            errorMessage={mismatch ? t('The passwords don’t match.') : undefined}
                            description={
                                matches ? (
                                    <span className="fieldOk">
                                        <LuCheck aria-hidden="true" /> {t('The passwords match.')}
                                    </span>
                                ) : undefined
                            }
                        />
                    </div>
                    <div className="pwActions">
                        <button type="button" className="ghostToggle" aria-pressed={show} onClick={() => setShow((value) => !value)}>
                            {show ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
                            {t('Show passwords')}
                        </button>
                        <AnimatePresence>
                            {changed && (
                                <motion.span
                                    className="pwChanged"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                                >
                                    <LuCheckCircle2 aria-hidden="true" /> {t('Updated')}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        <Button type="submit" color="danger" isLoading={password.saving} isDisabled={incomplete || tooShort || mismatch}>
                            {t('Save Password')}
                        </Button>
                    </div>
                </form>
            )}
        </SectionCard>
    );
};

export default PasswordCard;
