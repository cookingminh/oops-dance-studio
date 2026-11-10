import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LuLoader2, LuMail } from 'react-icons/lu';
import { OAUTH_PROVIDERS, authRedirectErrorFor, clearAuthRedirect, oauthError, openedWithSession, signIn } from '@/services/auth';
import { useAuth } from '@/auth/useAuth';
import { DEMO_MODE, DEMO_PASSWORD } from '@/lib/demo';
import { useI18n } from '@/i18n/i18nContext';
import AuthInput from './AuthInput';
import AuthLayout from './AuthLayout';
import DemoLogins from './DemoLogins';
import FormAlert from './FormAlert';
import OAuthButtons from './OAuthButtons';
import PasswordInput from './PasswordInput';
import SubmitButton from './SubmitButton';
import { toAlert } from './authShared';
import { useProviderSignIn } from './useProviderSignIn';

// After a successful sign-in (password, demo button or back from Google / Facebook), <PublicOnly>
// sends the user home once their profile and role are loaded.
const Login = () => {
    const { t } = useI18n();
    const { session } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // An OAuth error brought back in the URL shows straight away.
    const [alert, setAlert] = useState(() => {
        const redirectError = authRedirectErrorFor('/login');
        return redirectError ? toAlert(oauthError(redirectError)) : null;
    });
    const [pending, setPending] = useState(null); // 'form' or the demo account's email
    const oauth = useProviderSignIn((error) => setAlert(toAlert(error)));
    const busy = Boolean(pending || oauth.pending);
    // Back from Google / Facebook with a session in the URL: supabase-js is still reading it.
    const finishing = openedWithSession('/login') && session === undefined;

    useEffect(() => {
        if (!authRedirectErrorFor('/login')) return;
        clearAuthRedirect();
        // Drop ?error=… / #error=… so a refresh doesn't show the message again.
        navigate({ pathname: location.pathname }, { replace: true, state: location.state });
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        // The provider sent the user back with tokens Auth wouldn't accept (stale or reused link).
        if (!openedWithSession('/login') || session !== null) return;
        setAlert(toAlert(oauthError()));
        clearAuthRedirect();
    }, [session]);

    const logIn = async (loginEmail, loginPassword, source) => {
        setAlert(null);
        setPending(source);
        try {
            await signIn(loginEmail, loginPassword);
        } catch (error) {
            setAlert(toAlert(error));
            setPassword('');
            setPending(null);
            if (source === 'form') document.getElementById('password')?.focus();
        }
    };

    const onSubmit = (event) => {
        event.preventDefault();
        logIn(email, password, 'form');
    };

    if (finishing) {
        return (
            <AuthLayout step="finishing" title={t('Signing you in…')} subtitle={t('Just a moment while we open your account.')}>
                <div className="authFinishing" role="status">
                    <LuLoader2 className="authSpin" aria-hidden="true" />
                </div>
            </AuthLayout>
        );
    }

    const hasShortcuts = DEMO_MODE || OAUTH_PROVIDERS.length > 0;

    return (
        <AuthLayout
            title={t('Welcome back!')}
            subtitle={t('Log in to book rooms and manage your classes.')}
            footer={
                <>
                    {t('Don’t have an account?')}{' '}
                    <Link to="/register" state={location.state}>
                        {t('Sign up')}
                    </Link>
                </>
            }
        >
            <FormAlert alert={alert} />
            {DEMO_MODE && <DemoLogins pending={pending} disabled={busy} onPick={(demoEmail) => logIn(demoEmail, DEMO_PASSWORD, demoEmail)} />}
            <OAuthButtons pending={oauth.pending} disabled={busy} onPick={(provider) => { setAlert(null); oauth.start(provider); }} />
            {hasShortcuts && <p className="authDivider">{t('or sign in with email')}</p>}

            <form className="authForm" onSubmit={onSubmit}>
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
                <PasswordInput
                    id="password"
                    label={t('Password')}
                    autoComplete="current-password"
                    placeholder={t('Your password')}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />
                <p className="authForgot">
                    {t('Forgot your password?')} <Link to="/reset-password">{t('Click Here')}</Link>
                </p>
                <SubmitButton busy={pending === 'form'} disabled={busy} busyLabel={t('Logging in…')}>
                    {t('Login')}
                </SubmitButton>
            </form>
        </AuthLayout>
    );
};

export default Login;
