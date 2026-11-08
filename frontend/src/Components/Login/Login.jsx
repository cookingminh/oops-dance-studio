import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdMarkEmailRead } from 'react-icons/md';
import { BsFillShieldLockFill } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { signIn } from '@/services/auth';
import { DEMO_ACCOUNTS, DEMO_MODE, DEMO_PASSWORD } from '@/lib/demo';
import AuthInput from './AuthInput';

import loginImg from '@/assets/images/studio.webp';
import logo from '@/assets/images/logo.webp';

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
        <div className="loginPage flex">
            <div className="container flex">
                <div className="videoDiv">
                    <img src={loginImg} alt="Oops! Dance Studio room" />
                    <div className="footerDiv flex items-center">
                        <span className="text">Don’t have an account?</span>
                        <Link to="/register" className="btn">Sign Up</Link>
                    </div>
                </div>

                <div className="formDiv flex">
                    <div className="headerDiv">
                        <Link to="/home"><img src={logo} className="logo" alt="Oops! Dance Studio" /></Link>
                        <h3>Welcome Back!</h3>
                    </div>
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
                            placeholder="Enter Email"
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
                            placeholder="Enter Password"
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
                </div>
            </div>
        </div>
    );
};

export default Login;
