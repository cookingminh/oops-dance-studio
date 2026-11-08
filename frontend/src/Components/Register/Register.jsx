import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUserShield } from 'react-icons/fa';
import { BsFillShieldLockFill, BsPersonVcard } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { MdMarkEmailRead } from 'react-icons/md';
import { signUp } from '@/services/auth';
import { isUsernameAvailable } from '@/services/users';
import AuthInput from '../Login/AuthInput';
import AuthLayout from '../Login/AuthLayout';

import video from '@/assets/video/register.mp4';

const MIN_PASSWORD_LENGTH = 8; // auth.minimum_password_length in supabase/config.toml

// New accounts are always guests; the role is assigned server-side.
const Register = () => {
    const [form, setForm] = useState({ email: '', username: '', fullName: '', password: '' });
    const [status, setStatus] = useState('');
    const [needsConfirmation, setNeedsConfirmation] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

    const onSubmit = async (event) => {
        event.preventDefault();
        setStatus('');
        if (form.password.length < MIN_PASSWORD_LENGTH) {
            setStatus(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        setSubmitting(true);
        try {
            if (!(await isUsernameAvailable(form.username.trim()))) {
                setStatus('This username is already taken. Please choose another one.');
                return;
            }
            const { session } = await signUp(form);
            // With a session, <PublicOnly> redirects; without one, email confirmation is required.
            if (!session) setNeedsConfirmation(true);
        } catch (error) {
            setStatus(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            media={<video src={video} autoPlay muted loop playsInline aria-hidden="true"></video>}
            title={needsConfirmation ? 'Check your inbox' : 'Create your account'}
            subtitle={needsConfirmation ? null : 'Join the studio to book rooms and sign up for classes.'}
            footer={!needsConfirmation && <>Already have an account? <Link to="/login">Log in</Link></>}
        >
            {needsConfirmation ? (
                <div className="form grid">
                    <p className="text-center">
                        Almost there! We sent a confirmation link to <strong>{form.email}</strong>.
                        Open it to activate your account, then log in.
                    </p>
                    <Link to="/login" className="btn flex">Go to login</Link>
                </div>
            ) : (
                <form className="form grid" onSubmit={onSubmit}>
                    <span role="alert" className={status ? 'showMessage' : 'message'}>{status}</span>
                    <AuthInput
                        id="email"
                        label="Email"
                        icon={MdMarkEmailRead}
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        required
                        value={form.email}
                        onChange={update('email')}
                    />
                    <div className="formRow">
                        <AuthInput
                            id="username"
                            label="Username"
                            icon={FaUserShield}
                            autoComplete="username"
                            placeholder="e.g. thaovy"
                            required
                            value={form.username}
                            onChange={update('username')}
                        />
                        <AuthInput
                            id="fullName"
                            label="Full name"
                            icon={BsPersonVcard}
                            autoComplete="name"
                            placeholder="Your name"
                            required
                            value={form.fullName}
                            onChange={update('fullName')}
                        />
                    </div>
                    <AuthInput
                        id="password"
                        label="Password"
                        icon={BsFillShieldLockFill}
                        type="password"
                        autoComplete="new-password"
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        value={form.password}
                        onChange={update('password')}
                    />
                    <button type="submit" className="btn flex" disabled={submitting}>
                        <span>{submitting ? 'Creating account…' : 'Register'}</span>
                        <AiOutlineSwapRight className="icon" />
                    </button>
                </form>
            )}
        </AuthLayout>
    );
};

export default Register;
