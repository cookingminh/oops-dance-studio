import { NavLink, useNavigate } from 'react-router-dom';
import { Image } from '@nextui-org/react';
import { MdDashboard } from 'react-icons/md';
import { FaDoorClosed, FaDoorOpen, FaUserGroup } from 'react-icons/fa6';
import { AiOutlinePieChart } from 'react-icons/ai';
import { BsQuestionCircle } from 'react-icons/bs';
import { SiBytedance } from 'react-icons/si';
import { FaCalendarCheck } from 'react-icons/fa';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import LogoutButton from '../../../../Logout/LogoutButton';
import './sidebar.scss';
import logo from '@/assets/images/logo.webp';

const QUICK_MENU = [
    { to: '/admin', label: 'Dashboard', icon: MdDashboard, end: true },
    { to: '/admin/rooms', label: 'Rooms', icon: FaDoorOpen },
    { to: '/admin/bookings', label: 'Bookings', icon: FaDoorClosed },
    { to: '/admin/classes', label: 'Classes & Schedules', icon: SiBytedance },
    { to: '/admin/students', label: 'Students Manager', icon: SiBytedance },
    { to: '/admin/attendance-records', label: 'Instructor Attendance Records', icon: FaCalendarCheck },
];

const SETTINGS_MENU = [
    { to: '/admin/users', label: 'Users', icon: FaUserGroup, adminOnly: true },
    { to: '/admin/charts', label: 'Charts', icon: AiOutlinePieChart },
];

const MenuList = ({ items }) => (
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
);

const SideBar = () => {
    const navigate = useNavigate();
    const { role } = useAuth();
    const settings = SETTINGS_MENU.filter((item) => !item.adminOnly || role === ROLES.admin);

    return (
        <div className="sideBar grid">
            <div onClick={() => navigate('/home')} className="logoDiv flex justify-center items-center cursor-pointer">
                <Image className="min-w-16 md:min-w-20" isBlurred src={logo} alt="Oops! Dance Studio" />
                <h2>Oops! Dance Studio</h2>
            </div>

            <div className="menuDiv">
                <h3 className="divTitle">QUICK MENU</h3>
                <MenuList items={QUICK_MENU} />
            </div>

            <div className="settingsDiv">
                <h3 className="divTitle">SETTING</h3>
                <MenuList items={settings} />
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
