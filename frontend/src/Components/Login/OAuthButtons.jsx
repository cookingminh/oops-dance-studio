import { LuLoader2 } from 'react-icons/lu';
import { OAUTH_PROVIDERS, providerName } from '@/services/auth';
import { useI18n } from '@/i18n/i18nContext';
import { FacebookLogo, GoogleLogo } from './ProviderLogos';

const LOGOS = { google: GoogleLogo, facebook: FacebookLogo };

// "Or continue with" Google / Facebook, side by side under the form, for the providers listed in
// VITE_AUTH_PROVIDERS (nothing when it is unset). Each button shows the brand name and is named
// "Continue with Google". The same buttons sign in and sign up: a first visit creates a guest account.
const OAuthButtons = ({ pending, disabled, onPick }) => {
    const { t } = useI18n();
    if (OAUTH_PROVIDERS.length === 0) return null;

    return (
        <div className="authProviderBlock">
            <p className="authDivider">{t('or continue with')}</p>
            <div className="authProviders">
                {OAUTH_PROVIDERS.map((provider) => {
                    const Logo = LOGOS[provider];
                    const busy = pending === provider;
                    const name = providerName(provider);
                    return (
                        <button
                            key={provider}
                            type="button"
                            className={`authProvider is-${provider}`}
                            disabled={disabled}
                            aria-busy={busy}
                            aria-label={t('Continue with {provider}', { provider: name })}
                            onClick={() => onPick(provider)}
                        >
                            {busy ? <LuLoader2 className="authSpin" aria-hidden="true" /> : <Logo />}
                            <span>{name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default OAuthButtons;
