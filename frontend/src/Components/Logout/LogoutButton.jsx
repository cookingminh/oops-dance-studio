import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/ui/feedback/toastContext';
import { useI18n } from '@/i18n/i18nContext';

const LogoutButton = ({ className = 'btn', children }) => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const toast = useToast();

    const handleClick = async () => {
        // Leave the protected page first so its guard doesn't redirect to /login.
        navigate('/home', { replace: true });
        try {
            await signOut();
        } catch (error) {
            toast.error(error);
        }
    };

    return (
        <button type="button" className={className} onClick={handleClick}>
            {children ?? t('Log Out')}
        </button>
    );
};

export default LogoutButton;
