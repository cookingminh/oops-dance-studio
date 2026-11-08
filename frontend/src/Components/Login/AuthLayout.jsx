import { Link } from 'react-router-dom';
import logo from '@/assets/images/logo.webp';

// Shared shell of the login / register / reset-password pages: a photo or video
// panel on the left (hidden on narrow screens) and the form panel on the right.
const AuthLayout = ({ media, title, subtitle, footer, children }) => (
    <div className="authPage">
        <div className="authCard">
            <div className="authMedia">
                {media}
                <div className="authCaption">
                    <span className="authCaptionTitle">Oops! Dance Studio</span>
                    <p>Book a room, join a class and keep your dance schedule in one place.</p>
                </div>
            </div>

            <div className="authPanel">
                <div className="authHeader">
                    <Link to="/home" className="authLogo">
                        <img src={logo} alt="Oops! Dance Studio" />
                    </Link>
                    <h1>{title}</h1>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {children}
                {footer && <p className="authSwitch">{footer}</p>}
            </div>
        </div>
    </div>
);

export default AuthLayout;
