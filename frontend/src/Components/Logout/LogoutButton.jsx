import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/ui/feedback/toastContext';

const LogoutButton = ({ className = 'btn', children = 'Log Out' }) => {
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
            {children}
        </button>
    );
};

export default LogoutButton;
