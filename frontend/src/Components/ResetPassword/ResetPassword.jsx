import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LuKeyRound, LuMail, LuMailCheck } from 'react-icons/lu';
import { authRedirectErrorFor, clearAuthRedirect, requestPasswordReset, updatePassword } from '@/services/auth';
import { useAuth } from '@/auth/useAuth';
import { useI18n } from '@/i18n/i18nContext';
import { homePathFor } from '@/auth/roles';
import { useToast } from '@/ui/feedback/toastContext';
import { Loading } from '@/ui/feedback/AsyncState';
import AuthInput from '../Login/AuthInput';
import AuthLayout from '../Login/AuthLayout';
import AuthNotice from '../Login/AuthNotice';
import FormAlert from '../Login/FormAlert';
import PasswordInput from '../Login/PasswordInput';
import SubmitButton from '../Login/SubmitButton';
import { MIN_PASSWORD_LENGTH, toAlert } from '../Login/authShared';

const EXPIRED_LINK = { text: 'This reset link is invalid or has expired. Please request a new one.' };

// Step 1 (no recovery session): ask for the email and send the reset link.
// Step 2 (opened from that link): set a new password.
const ResetPassword = () => {
    const { recovering, isAuthenticated, loading, role, finishRecovery } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const { t } = useI18n();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    // A reset link that failed comes back here with an error in the URL.
    const [alert, setAlert] = useState(() => (authRedirectErrorFor('/reset-password') ? EXPIRED_LINK : null));
    const [sent, setSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const settingNewPassword = recovering && isAuthenticated;

    useEffect(() => {
        if (authRedirectErrorFor('/reset-password')) clearAuthRedirect();
    }, []);

    const onRequestLink = async (event) => {
        event.preventDefault();
        setAlert(null);
        setSubmitting(true);
        try {
            await requestPasswordReset(email);
            setSent(true);
        } catch (error) {
            setAlert(toAlert(error));
        } finally {
            setSubmitting(false);
        }
    };

    const onSetPassword = async (event) => {
        event.preventDefault();
        setAlert(null);
        if (password.length < MIN_PASSWORD_LENGTH) {
            setAlert({ text: 'Password must be at least {count} characters.', vars: { count: MIN_PASSWORD_LENGTH } });
            return;
        }
        if (password !== confirm) {
            setAlert({ text: 'The two passwords don’t match.' });
            return;
        }
        setSubmitting(true);
        try {
            await updatePassword(password);
            finishRecovery();
            toast.success('Your password has been updated.');
            navigate(homePathFor(role), { replace: true });
        } catch (error) {
            setAlert(toAlert(error));
            setSubmitting(false);
        }
    };

    if (recovering && loading) {
        return (
            <AuthLayout step="loading" title={t('Choose a new password')}>
                <Loading />
            </AuthLayout>
        );
    }

    if (settingNewPassword) {
        const matches = confirm.length > 0 && confirm === password;
        return (
            <AuthLayout step="new-password" title={t('Choose a new password')} subtitle={t('Pick something you’ll remember. You’ll use it the next time you log in.')}>
                <FormAlert alert={alert} />
                <form className="authForm" onSubmit={onSetPassword}>
                    <PasswordInput
                        id="new-password"
                        label={t('New password')}
                        icon={LuKeyRound}
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        rule={{
                            text: t('At least {count} characters', { count: MIN_PASSWORD_LENGTH }),
                            met: password.length >= MIN_PASSWORD_LENGTH,
                        }}
                    />
                    <PasswordInput
                        id="confirm-password"
                        label={t('Confirm new password')}
                        icon={LuKeyRound}
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        rule={matches ? { text: t('The passwords match.'), met: true } : undefined}
                    />
                    <SubmitButton busy={submitting} busyLabel={t('Saving…')}>
                        {t('Save new password')}
                    </SubmitButton>
                </form>
            </AuthLayout>
        );
    }

    if (sent) {
        return (
            <AuthLayout step="sent" title={t('Check your inbox')}>
                <AuthNotice
                    icon={LuMailCheck}
                    action={
                        <Link to="/login" className="authSubmit">
                            {t('Back to login')}
                        </Link>
                    }
                    tip={t('Can’t find it? Check your spam folder.')}
                >
                    {t('If an account exists for')}
                    <strong className="authNoticeEmail">{email}</strong>
                    {t('a reset link is on its way. Check your inbox and open the link on this device.')}
                </AuthNotice>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title={t('Reset your password')}
            subtitle={t('Enter your account email and we’ll send you a link to reset it.')}
            footer={
                <>
                    {t('Remembered it?')} <Link to="/login">{t('Back to login')}</Link>
                </>
            }
        >
            <FormAlert alert={alert} />
            <form className="authForm" onSubmit={onRequestLink}>
                <AuthInput
                    id="email"
                    label={t('Email')}
                    icon={LuMail}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                <SubmitButton busy={submitting} busyLabel={t('Sending…')}>
                    {t('Send reset link')}
                </SubmitButton>
            </form>
        </AuthLayout>
    );
};

export default ResetPassword;
