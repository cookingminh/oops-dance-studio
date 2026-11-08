import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdMarkEmailRead } from 'react-icons/md';
import { BsFillShieldLockFill } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { authRedirectError } from '@/lib/supabase';
import { requestPasswordReset, updatePassword } from '@/services/auth';
import { useAuth } from '@/auth/useAuth';
import { homePathFor } from '@/auth/roles';
import { useToast } from '@/ui/feedback/toastContext';
import { Loading } from '@/ui/feedback/AsyncState';
import AuthInput from '../Login/AuthInput';

import loginImg from '@/assets/images/studio.webp';
import logo from '@/assets/images/logo.webp';

const MIN_PASSWORD_LENGTH = 8;

// Step 1 (no recovery session): ask for the email and send the reset link.
// Step 2 (opened from that link): set a new password.
const ResetPassword = () => {
    const { recovering, isAuthenticated, loading, role, finishRecovery } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [status, setStatus] = useState(
        authRedirectError ? 'This reset link is invalid or has expired. Please request a new one.' : ''
    );
    const [sent, setSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const settingNewPassword = recovering && isAuthenticated;

    const onRequestLink = async (event) => {
        event.preventDefault();
        setStatus('');
        setSubmitting(true);
        try {
            await requestPasswordReset(email);
            setSent(true);
        } catch (error) {
            setStatus(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const onSetPassword = async (event) => {
        event.preventDefault();
        setStatus('');
        if (password.length < MIN_PASSWORD_LENGTH) {
            setStatus(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (password !== confirm) {
            setStatus('The two passwords don’t match.');
            return;
        }
        setSubmitting(true);
        try {
            await updatePassword(password);
            finishRecovery();
            toast.success('Your password has been updated.');
            navigate(homePathFor(role), { replace: true });
        } catch (error) {
            setStatus(error.message);
            setSubmitting(false);
        }
    };

    const renderBody = () => {
        if (recovering && loading) return <Loading />;
        if (settingNewPassword) {
            return (
                <form className="form grid" onSubmit={onSetPassword}>
                    <span role="alert" className={status ? 'showMessage' : 'message'}>{status}</span>
                    <AuthInput
                        id="new-password"
                        label="New password"
                        icon={BsFillShieldLockFill}
                        type="password"
                        autoComplete="new-password"
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                    <AuthInput
                        id="confirm-password"
                        label="Confirm new password"
                        icon={BsFillShieldLockFill}
                        type="password"
                        autoComplete="new-password"
                        required
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                    />
                    <button type="submit" className="btn flex" disabled={submitting}>
                        <span>{submitting ? 'Saving…' : 'Save new password'}</span>
                        <AiOutlineSwapRight className="icon" />
                    </button>
                </form>
            );
        }
        if (sent) {
            return (
                <div className="form grid">
                    <p className="text-center">
                        If an account exists for <strong>{email}</strong>, a reset link is on its way.
                        Check your inbox and open the link on this device.
                    </p>
                    <Link to="/login" className="btn flex">Back to login</Link>
                </div>
            );
        }
        return (
            <form className="form grid" onSubmit={onRequestLink}>
                <span role="alert" className={status ? 'showMessage' : 'message'}>{status}</span>
                <AuthInput
                    id="email"
                    label="Email"
                    icon={MdMarkEmailRead}
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your account email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                <button type="submit" className="btn flex" disabled={submitting}>
                    <span>{submitting ? 'Sending…' : 'Send reset link'}</span>
                    <AiOutlineSwapRight className="icon" />
                </button>
                <span className="forgotPassword">
                    Remembered it? <Link to="/login">Back to login</Link>
                </span>
            </form>
        );
    };

    return (
        <div className="loginPage flex">
            <div className="container flex">
                <div className="videoDiv">
                    <img src={loginImg} alt="Oops! Dance Studio room" />
                </div>
                <div className="formDiv flex">
                    <div className="headerDiv">
                        <Link to="/home"><img src={logo} className="logo" alt="Oops! Dance Studio" /></Link>
                        <h3>{settingNewPassword ? 'Choose a new password' : 'Reset your password'}</h3>
                    </div>
                    {renderBody()}
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
