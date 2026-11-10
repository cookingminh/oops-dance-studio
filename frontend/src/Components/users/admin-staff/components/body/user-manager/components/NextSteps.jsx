import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@nextui-org/react';
import { LuCalendarDays, LuCheck, LuChevronRight, LuCopy, LuGraduationCap, LuUser, LuWallet } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import RoleChip from './RoleChip';

// What to set up next for each role (English keys). `enrol` opens the person's panel with the
// class picker ready; `to` goes to another workspace page.
const STEPS = {
    guest: [{ key: 'enrol', icon: LuGraduationCap, title: 'Enrol them in a class', text: 'They show up as a Student once they join a class.' }],
    instructor: [
        { key: 'classes', icon: LuCalendarDays, title: 'Give them a class to teach', text: 'Choose them as the instructor on the Classes page.', to: '/admin/classes' },
        { key: 'pay', icon: LuWallet, title: 'Check their pay rate', text: 'Instructors are paid per completed session.', to: '/admin/payroll' },
    ],
    staff: [{ key: 'pay', icon: LuWallet, title: 'Set their monthly salary', text: 'In Payroll, under Rates & salaries.', to: '/admin/payroll' }],
    admin: [{ key: 'pay', icon: LuWallet, title: 'Set a monthly salary', text: 'Only if the studio pays them.', to: '/admin/payroll' }],
};
const OPEN_PROFILE = { key: 'open', icon: LuUser, title: 'Open their profile', text: 'Check their details or change anything later.' };

// The last step of "Add a person": sign-in details to send and role-specific next steps.
const NextSteps = ({ person, onOpenPerson }) => {
    const { t } = useI18n();
    const toast = useToast();
    const [copied, setCopied] = useState(false);
    const name = person.full_name || person.email;
    const signInUrl = `${window.location.origin}/login`;
    const kind = person.role; // a new guest isn't in a class yet, so not a Student

    const copy = async () => {
        const text = [
            t('Your Oops! Dance Studio account is ready.'),
            `${t('Sign in at')}: ${signInUrl}`,
            `${t('Email')}: ${person.email}`,
            `${t('Temporary password')}: ${person.password}`,
            t('Please change your password in Profile settings after you sign in.'),
        ].join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            toast.error('Couldn’t copy. Select the text and copy it yourself.');
        }
    };

    const stepContent = (step) => {
        const Icon = step.icon;
        return (
            <>
                <span className="stepIcon" aria-hidden="true">
                    <Icon />
                </span>
                <span className="stepText">
                    <strong>{t(step.title)}</strong>
                    <small>{t(step.text)}</small>
                </span>
                <LuChevronRight className="stepGo" aria-hidden="true" />
            </>
        );
    };

    return (
        <div className="nextSteps">
            <div className="readyBanner">
                <motion.span
                    className="readyIcon"
                    aria-hidden="true"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}
                >
                    <LuCheck />
                </motion.span>
                <div>
                    <strong>{t('{name} can sign in now', { name })}</strong>
                    <span>
                        <RoleChip kind={kind} />
                        <span className="readyEmail">{person.email}</span>
                    </span>
                </div>
            </div>

            <section className="signInCard" aria-labelledby="sign-in-details">
                <h4 id="sign-in-details">{t('Sign-in details')}</h4>
                <dl>
                    <div>
                        <dt>{t('Sign in at')}</dt>
                        <dd>{signInUrl}</dd>
                    </div>
                    <div>
                        <dt>{t('Email')}</dt>
                        <dd>{person.email}</dd>
                    </div>
                    <div>
                        <dt>{t('Temporary password')}</dt>
                        <dd className="isMono">{person.password}</dd>
                    </div>
                </dl>
                <div className="signInFoot">
                    <span>{t('Send them privately, e.g. on Zalo or by text message.')}</span>
                    <Button size="sm" variant="flat" color={copied ? 'success' : 'default'} startContent={copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />} onPress={copy}>
                        {copied ? t('Copied') : t('Copy sign-in details')}
                    </Button>
                </div>
            </section>

            <section aria-labelledby="next-steps-title">
                <h4 id="next-steps-title">{t('What’s next')}</h4>
                <ul className="stepLinks">
                    {[...(STEPS[person.role] ?? []), OPEN_PROFILE].map((step) => (
                        <li key={step.key}>
                            {step.to ? (
                                <Link className="stepLink" to={step.to}>
                                    {stepContent(step)}
                                </Link>
                            ) : (
                                <button type="button" className="stepLink" onClick={() => onOpenPerson(person.id, step.key === 'enrol' ? 'enrol' : null)}>
                                    {stepContent(step)}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
};

export default NextSteps;
