import { LuLoader2 } from 'react-icons/lu';
import { OAUTH_PROVIDERS, providerName } from '@/services/auth';
import { useI18n } from '@/i18n/i18nContext';
import { FacebookLogo, GoogleLogo } from './ProviderLogos';

const LOGOS = { google: GoogleLogo, facebook: FacebookLogo };

// "Continue with Google / Facebook" for the providers listed in VITE_AUTH_PROVIDERS (nothing when
// it is unset). The same buttons sign in and sign up: a first visit creates a guest account.
const OAuthButtons = ({ pending, disabled, onPick }) => {
    const { t } = useI18n();
    if (OAUTH_PROVIDERS.length === 0) return null;

    return (
        <div className="authProviders">
            {OAUTH_PROVIDERS.map((provider) => {
                const Logo = LOGOS[provider];
                const busy = pending === provider;
                return (
                    <button
                        key={provider}
                        type="button"
                        className={`authProvider is-${provider}`}
                        disabled={disabled}
                        aria-busy={busy}
                        onClick={() => onPick(provider)}
                    >
                        {busy ? <LuLoader2 className="authSpin" aria-hidden="true" /> : <Logo />}
                        <span>{t('Continue with {provider}', { provider: providerName(provider) })}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default OAuthButtons;
