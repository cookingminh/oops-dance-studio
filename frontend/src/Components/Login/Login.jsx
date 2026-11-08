import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdMarkEmailRead } from 'react-icons/md';
import { BsFillShieldLockFill } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { signIn } from '@/services/auth';
import { DEMO_ACCOUNTS, DEMO_MODE, DEMO_PASSWORD } from '@/lib/demo';
import AuthInput from './AuthInput';
import AuthLayout from './AuthLayout';

import loginImg from '@/assets/images/studio.webp';

// After a successful sign-in, <PublicOnly> redirects once the profile (and role) is loaded.
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const logIn = async (loginEmail, loginPassword) => {
        setStatus('');
        setSubmitting(true);
        try {
            await signIn(loginEmail, loginPassword);
        } catch (error) {
            setStatus(error.message);
            setPassword('');
            setSubmitting(false);
        }
    };

    const onSubmit = (event) => {
        event.preventDefault();
        logIn(email, password);
    };

    return (
        <AuthLayout
            media={<img src={loginImg} alt="" />}
            title="Welcome back!"
            subtitle="Log in to book rooms and manage your classes."
            footer={<>Don’t have an account? <Link to="/register">Sign up</Link></>}
        >
            <form className="form grid" onSubmit={onSubmit}>
                <span role="alert" className={status ? 'showMessage' : 'message'}>{status}</span>
                {DEMO_MODE && (
                    <div className="demoLogins">
                        <span className="demoTitle">One-click demo login</span>
                        <div className="demoButtons">
                            {DEMO_ACCOUNTS.map((account) => (
                                <button
                                    type="button"
                                    key={account.email}
                                    className="demoBtn"
                                    title={account.email}
                                    disabled={submitting}
                                    onClick={() => logIn(account.email, DEMO_PASSWORD)}
                                >
                                    {account.label}
                                </button>
                            ))}
                        </div>
                        <span className="demoTitle">or sign in with email</span>
                    </div>
                )}
                <AuthInput
                    id="email"
                    label="Email"
                    icon={MdMarkEmailRead}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                <AuthInput
                    id="password"
                    label="Password"
                    icon={BsFillShieldLockFill}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />
                <button type="submit" className="btn flex" disabled={submitting}>
                    <span>{submitting ? 'Logging in…' : 'Login'}</span>
                    <AiOutlineSwapRight className="icon" />
                </button>
                <span className="forgotPassword">
                    Forgot your password? <Link to="/reset-password">Click Here</Link>
                </span>
            </form>
        </AuthLayout>
    );
};

export default Login;
