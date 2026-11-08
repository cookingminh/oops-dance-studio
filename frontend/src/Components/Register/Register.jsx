import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUserShield } from 'react-icons/fa';
import { BsFillShieldLockFill, BsPersonVcard } from 'react-icons/bs';
import { AiOutlineSwapRight } from 'react-icons/ai';
import { MdMarkEmailRead } from 'react-icons/md';
import { signUp } from '@/services/auth';
import { isUsernameAvailable } from '@/services/users';
import AuthInput from '../Login/AuthInput';

import video from '@/assets/video/register.mp4';
import logo from '@/assets/images/logo.webp';

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
        <div className="registerPage flex">
            <div className="container flex">
                <div className="videoDiv">
                    <video src={video} autoPlay muted loop playsInline></video>
                    <div className="footerDiv flex items-center">
                        <span className="text">Already have an account?</span>
                        <Link to="/login" className="btn">Log In</Link>
                    </div>
                </div>

                <div className="formDiv flex">
                    <div className="headerDiv">
                        <Link to="/home"><img src={logo} className="logo" alt="Oops! Dance Studio" /></Link>
                        <h3>Create your account</h3>
                    </div>

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
                                placeholder="Enter Email"
                                required
                                value={form.email}
                                onChange={update('email')}
                            />
                            <AuthInput
                                id="username"
                                label="Username"
                                icon={FaUserShield}
                                autoComplete="username"
                                placeholder="Enter Username"
                                required
                                value={form.username}
                                onChange={update('username')}
                            />
                            <AuthInput
                                id="fullName"
                                label="Full name"
                                icon={BsPersonVcard}
                                autoComplete="name"
                                placeholder="Enter Full Name"
                                required
                                value={form.fullName}
                                onChange={update('fullName')}
                            />
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
                </div>
            </div>
        </div>
    );
};

export default Register;
