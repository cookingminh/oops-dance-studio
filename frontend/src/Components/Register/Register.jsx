import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LuAtSign, LuMail, LuUser } from 'react-icons/lu';
import { signUp } from '@/services/auth';
import { isUsernameAvailable } from '@/services/users';
import { useI18n } from '@/i18n/i18nContext';
import AuthInput from '../Login/AuthInput';
import AuthLayout from '../Login/AuthLayout';
import AuthNotice from '../Login/AuthNotice';
import FormAlert from '../Login/FormAlert';
import OAuthButtons from '../Login/OAuthButtons';
import PasswordInput from '../Login/PasswordInput';
import SubmitButton from '../Login/SubmitButton';
import { MIN_PASSWORD_LENGTH, toAlert } from '../Login/authShared';
import { useProviderSignIn } from '../Login/useProviderSignIn';

// New accounts are always guests; the role is assigned server-side. Google / Facebook sign-ups
// skip this form (no username or phone yet; the profile overview nudges them to add both).
const Register = () => {
    const { t } = useI18n();
    const location = useLocation();
    const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '' });
    const [alert, setAlert] = useState(null);
    const [needsConfirmation, setNeedsConfirmation] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const oauth = useProviderSignIn((error) => setAlert(toAlert(error)));
    const busy = submitting || Boolean(oauth.pending);

    const update = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
        // A message about this field goes once it is being fixed.
        setAlert((current) => (current?.field === field ? null : current));
    };
    // The message for one field (shown under it), translated.
    const errorFor = (field) => (alert?.field === field ? t(alert.text, alert.vars) : null);

    const onSubmit = async (event) => {
        event.preventDefault();
        setAlert(null);
        if (form.password.length < MIN_PASSWORD_LENGTH) {
            setAlert({ text: 'Password must be at least {count} characters.', vars: { count: MIN_PASSWORD_LENGTH }, field: 'password' });
            return;
        }
        setSubmitting(true);
        try {
            if (!(await isUsernameAvailable(form.username.trim()))) {
                setAlert({ text: 'This username is already taken. Please choose another one.', field: 'username' });
                document.getElementById('username')?.focus();
                return;
            }
            const { session } = await signUp(form);
            // With a session, <PublicOnly> redirects; without one, email confirmation is required.
            if (!session) setNeedsConfirmation(true);
        } catch (error) {
            setAlert(toAlert(error));
        } finally {
            setSubmitting(false);
        }
    };

    if (needsConfirmation) {
        return (
            <AuthLayout step="confirm" title={t('Check your inbox')}>
                <AuthNotice
                    action={
                        <Link to="/login" state={location.state} className="authSubmit">
                            {t('Go to login')}
                        </Link>
                    }
                    tip={t('Can’t find it? Check your spam folder.')}
                >
                    {t('Almost there! We sent a confirmation link to')}
                    <strong className="authNoticeEmail">{form.email}</strong>
                    {t('Open it to activate your account, then log in.')}
                </AuthNotice>
            </AuthLayout>
        );
    }

    return (
        // "Log in" is the Log in | Sign up switch above (AuthShell); Google / Facebook come after the form.
        <AuthLayout title={t('Create your account')} subtitle={t('Join the Oops! family. Your first class is free.')}>
            <FormAlert alert={alert} />
            <form className="authForm" onSubmit={onSubmit}>
                <div className="authFieldRow">
                    <AuthInput
                        id="fullName"
                        label={t('Full name')}
                        icon={LuUser}
                        autoComplete="name"
                        required
                        value={form.fullName}
                        onChange={update('fullName')}
                    />
                    <AuthInput
                        id="username"
                        label={t('Username')}
                        icon={LuAtSign}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        value={form.username}
                        onChange={update('username')}
                        error={errorFor('username')}
                    />
                </div>
                <AuthInput
                    id="email"
                    label={t('Email')}
                    icon={LuMail}
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={update('email')}
                />
                <PasswordInput
                    id="password"
                    label={t('Password')}
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={form.password}
                    onChange={update('password')}
                    error={errorFor('password')}
                    strength
                    rule={{
                        text: t('At least {count} characters', { count: MIN_PASSWORD_LENGTH }),
                        met: form.password.length >= MIN_PASSWORD_LENGTH,
                    }}
                />
                <SubmitButton busy={submitting} disabled={busy} busyLabel={t('Creating account…')}>
                    {t('Register')}
                </SubmitButton>
            </form>
            <OAuthButtons pending={oauth.pending} disabled={busy} onPick={(provider) => { setAlert(null); oauth.start(provider); }} />
        </AuthLayout>
    );
};

export default Register;
