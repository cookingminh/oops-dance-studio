import { LuClipboardList, LuCrown, LuLoader2, LuMic2, LuSmile, LuSparkles } from 'react-icons/lu';
import { DEMO_ACCOUNTS } from '@/lib/demo';
import { useI18n } from '@/i18n/i18nContext';

const ROLE_ICONS = { Admin: LuCrown, Staff: LuClipboardList, Instructor: LuMic2, Guest: LuSmile };

// Public demo only (VITE_DEMO_MODE): one button per role. Each button's name is just the role
// ("Admin", "Guest"…); the e2e demo spec clicks them by that exact name.
const DemoLogins = ({ pending, disabled, onPick }) => {
    const { t } = useI18n();
    return (
        <section className="authDemo" aria-labelledby="demo-logins-title">
            <p id="demo-logins-title" className="authDemoTitle">
                <LuSparkles aria-hidden="true" /> {t('One-click demo login')}
            </p>
            <div className="authDemoGrid">
                {DEMO_ACCOUNTS.map((account) => {
                    const Icon = pending === account.email ? LuLoader2 : (ROLE_ICONS[account.label] ?? LuSmile);
                    return (
                        <button
                            type="button"
                            key={account.email}
                            className="authDemoBtn"
                            title={account.email}
                            disabled={disabled}
                            onClick={() => onPick(account.email)}
                        >
                            <Icon className={pending === account.email ? 'authSpin' : undefined} aria-hidden="true" />
                            <span>{t(account.label)}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

export default DemoLogins;
