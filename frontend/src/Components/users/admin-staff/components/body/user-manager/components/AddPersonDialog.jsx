import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@nextui-org/react';
import { LuArrowLeft, LuCheck, LuDices, LuEye, LuEyeOff } from 'react-icons/lu';
import { createUser } from '@/services/users';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import DateField from '@/ui/DateField';
import { EASE_OUT } from '../../../common/motion';
import { ROLE_INFO, generatePassword } from '../peopleModel';
import RoleCards from './RoleCards';
import RoleChip from './RoleChip';
import NextSteps from './NextSteps';

const MIN_PASSWORD_LENGTH = 8;
const STEPS = ['role', 'details', 'done'];
const STEP_LABELS = { role: 'Role', details: 'Personal details', done: 'Next steps' };

const stepMotion = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: EASE_OUT } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

// Add a person in three steps: pick the role (with what it can open), fill in the details, then
// "next steps": the sign-in details to send them and what to set up for that role.
const AddPersonDialog = ({ initialRole, onClose, onCreated, onOpenPerson }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [step, setStep] = useState('role');
    const [role, setRole] = useState(initialRole ?? null);
    const [form, setForm] = useState(() => ({ fullName: '', email: '', password: generatePassword(), contactNumber: '', dateOfBirth: '' }));
    const [showPassword, setShowPassword] = useState(true);
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState(null);
    const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

    const passwordTooShort = form.password.length > 0 && form.password.length < MIN_PASSWORD_LENGTH;
    const canCreate = form.fullName.trim() && form.email.trim() && form.password.length >= MIN_PASSWORD_LENGTH;

    const create = async (event) => {
        event?.preventDefault();
        if (!canCreate || saving) return;
        setSaving(true);
        try {
            const result = await createUser({ ...form, role });
            toast.success(t('Account created for {email}.', { email: form.email.trim() }));
            setCreated({ ...result.user, password: form.password });
            setStep('done');
            onCreated();
        } catch (error) {
            toast.error(error);
        } finally {
            setSaving(false);
        }
    };

    const startOver = () => {
        setCreated(null);
        setForm({ fullName: '', email: '', password: generatePassword(), contactNumber: '', dateOfBirth: '' });
        setStep('role');
    };

    const stepIndex = STEPS.indexOf(step);

    return (
        <Modal
            isOpen
            onOpenChange={(open) => !open && onClose()}
            size="2xl"
            scrollBehavior="inside"
            placement="center"
            isDismissable={step !== 'details'}
            classNames={{ base: 'addPersonModal adminPortal' }}
        >
            <ModalContent>
                <ModalHeader className="addPersonHead">{step === 'done' ? t('Account ready') : t('Add a person')}</ModalHeader>
                <ol className="stepDots" aria-label={t('Step {current} of {total}', { current: stepIndex + 1, total: STEPS.length })}>
                    {STEPS.map((key, index) => (
                        <li key={key} className={index < stepIndex ? 'isDone' : index === stepIndex ? 'isCurrent' : undefined} aria-current={index === stepIndex ? 'step' : undefined}>
                            <span className="stepDot" aria-hidden="true">
                                {index < stepIndex ? <LuCheck /> : index + 1}
                            </span>
                            <span className="stepLabel">{t(STEP_LABELS[key])}</span>
                        </li>
                    ))}
                </ol>

                <AnimatePresence mode="wait" initial={false}>
                    {step === 'role' && (
                        <motion.div key="role" className="addPersonStep" {...stepMotion}>
                            <ModalBody>
                                <p className="viewIntro">{t('Who are you adding? The role decides which pages they can open. You can change it later.')}</p>
                                <RoleCards name="new-person-role" value={role} onChange={setRole} label={t('Role')} />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>
                                    {t('Cancel')}
                                </Button>
                                <Button color="danger" isDisabled={!role} onPress={() => setStep('details')}>
                                    {t('Continue')}
                                </Button>
                            </ModalFooter>
                        </motion.div>
                    )}

                    {step === 'details' && (
                        <motion.form key="details" className="addPersonStep" onSubmit={create} {...stepMotion}>
                            <ModalBody>
                                <div className="roleRecap">
                                    <RoleChip kind={ROLE_INFO[role].kind} label={t(ROLE_INFO[role].title)} />
                                    <span>{t(ROLE_INFO[role].opens)}</span>
                                    <Button size="sm" variant="light" onPress={() => setStep('role')}>
                                        {t('Change')}
                                    </Button>
                                </div>
                                <Input label={t('Full name')} isRequired autoFocus value={form.fullName} onValueChange={set('fullName')} />
                                <Input label={t('Email')} type="email" isRequired value={form.email} onValueChange={set('email')} description={t('They sign in with this email.')} />
                                <Input
                                    label={t('Temporary password')}
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    isRequired
                                    value={form.password}
                                    onValueChange={set('password')}
                                    isInvalid={passwordTooShort}
                                    errorMessage={passwordTooShort ? t('At least {count} characters.', { count: MIN_PASSWORD_LENGTH }) : undefined}
                                    description={t('Share it with them; they can change it in Profile settings.')}
                                    classNames={{ input: 'font-mono' }}
                                    endContent={
                                        <span className="passwordTools">
                                            <button type="button" aria-label={showPassword ? t('Hide password') : t('Show password')} onClick={() => setShowPassword((value) => !value)}>
                                                {showPassword ? <LuEyeOff /> : <LuEye />}
                                            </button>
                                            <button type="button" aria-label={t('Make a new password')} onClick={() => set('password')(generatePassword())}>
                                                <LuDices />
                                            </button>
                                        </span>
                                    }
                                />
                                <div className="formPair">
                                    <Input label={t('Phone')} type="tel" value={form.contactNumber} onValueChange={set('contactNumber')} />
                                    <DateField label={t('Date of birth')} value={form.dateOfBirth} onChange={set('dateOfBirth')} />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" startContent={<LuArrowLeft aria-hidden="true" />} onPress={() => setStep('role')} isDisabled={saving}>
                                    {t('Back')}
                                </Button>
                                <Button type="submit" color="danger" isLoading={saving} isDisabled={!canCreate}>
                                    {t('Create account')}
                                </Button>
                            </ModalFooter>
                        </motion.form>
                    )}

                    {step === 'done' && created && (
                        <motion.div key="done" className="addPersonStep" {...stepMotion}>
                            <ModalBody>
                                <NextSteps person={created} onOpenPerson={onOpenPerson} />
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={startOver}>
                                    {t('Add another person')}
                                </Button>
                                <Button color="danger" onPress={onClose}>
                                    {t('Done')}
                                </Button>
                            </ModalFooter>
                        </motion.div>
                    )}
                </AnimatePresence>
            </ModalContent>
        </Modal>
    );
};

export default AddPersonDialog;
