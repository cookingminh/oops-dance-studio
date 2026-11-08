import { NavLink, useNavigate } from 'react-router-dom';
import { Image } from '@nextui-org/react';
import { IoMdSpeedometer } from 'react-icons/io';
import { MdDashboard, MdDeliveryDining, MdOutlineExplore, MdOutlinePermContactCalendar } from 'react-icons/md';
import { BsQuestionCircle } from 'react-icons/bs';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import LogoutButton from '../../../../Logout/LogoutButton';
import './sidebar.scss';
import logo from '@/assets/images/logo.webp';

const MENUS = {
    [ROLES.instructor]: [
        { to: '/profile', label: 'Overview', icon: MdDashboard, end: true },
        { to: '/profile/my-classes', label: 'My Classes', icon: MdDeliveryDining },
        { to: '/profile/my-bookings', label: 'My Bookings', icon: MdOutlineExplore },
        { to: '/profile/attendance', label: 'Attendance', icon: IoMdSpeedometer },
    ],
    [ROLES.guest]: [
        { to: '/profile', label: 'Overview', icon: MdDashboard, end: true },
        { to: '/profile/my-classes', label: 'My Classes', icon: MdDeliveryDining },
        { to: '/profile/my-bookings', label: 'My Bookings', icon: MdOutlineExplore },
        { to: '/profile/my-attendance', label: 'My Attendance', icon: IoMdSpeedometer },
    ],
};

const SideBar = () => {
    const navigate = useNavigate();
    const { role } = useAuth();
    const items = MENUS[role] ?? [];

    return (
        <div className="sideBar grid">
            <div onClick={() => navigate('/home')} className="logoDiv flex justify-center items-center cursor-pointer">
                <Image className="min-w-16 md:min-w-20" isBlurred src={logo} alt="Oops! Dance Studio" />
                <h2>Oops! Dance Studio</h2>
            </div>

            <div className="menuDiv">
                <h3 className="divTitle">QUICK MENU</h3>
                <ul className="menuLists grid">
                    {items.map(({ to, label, icon: Icon, end }) => (
                        <li key={to} className="listItem">
                            <NavLink to={to} end={end} className="menuLink flex">
                                <Icon className="icon" />
                                <span className="smallText">{label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="settingsDiv">
                <h3 className="divTitle">SETTING</h3>
                <ul className="menuLists grid">
                    <li className="listItem">
                        <NavLink to="/profile/my-profile" className="menuLink flex">
                            <MdOutlinePermContactCalendar className="icon" />
                            <span className="smallText">My Profile Setting</span>
                        </NavLink>
                    </li>
                </ul>
            </div>

            <div className="logOutBtn flex">
                <LogoutButton />
            </div>

            <div className="sideBarCard">
                <BsQuestionCircle className="icon" />
                <div className="cardContent">
                    <div className="circle1"></div>
                    <div className="circle2"></div>
                    <h3>Help Center</h3>
                    <p>Having any trouble in Oops! Dance Studio, please contact us.</p>
                    <a className="btn" href="mailto:oopsdancestudio@gmail.com">Contact</a>
                </div>
            </div>
        </div>
    );
};

export default SideBar;
