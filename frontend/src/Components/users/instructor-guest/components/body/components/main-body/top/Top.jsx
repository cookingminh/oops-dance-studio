import { useNavigate } from 'react-router-dom';
import { Avatar } from '@nextui-org/react';
import { BiSearchAlt } from 'react-icons/bi';
import { TbMessageCircle } from 'react-icons/tb';
import { BsArrowRightShort, BsQuestionCircle } from 'react-icons/bs';
import { RiNotificationLine } from 'react-icons/ri';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { useAsync } from '@/hooks/useAsync';
import { myStats } from '@/services/stats';
import './top.scss';
import video from '@/assets/video/dashboard.mp4';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

const STAT_LABELS = {
    [ROLES.instructor]: [
        ['class_count', 'Classes'],
        ['completed_sessions', 'Sessions taught'],
    ],
    [ROLES.guest]: [
        ['class_count', 'Classes'],
        ['attended_count', 'Attended'],
        ['absent_count', 'Absent'],
    ],
};

const SHORTCUTS = {
    [ROLES.instructor]: [
        ['/profile/attendance', 'Check in'],
        ['/profile/my-classes', 'My Classes'],
    ],
    [ROLES.guest]: [
        ['/home', 'Book a room'],
        ['/profile/my-bookings', 'My Bookings'],
    ],
};

// Profile overview for instructors and guests, from my_stats().
const Top = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const stats = useAsync(myStats, []);
    const name = user.full_name || user.username;
    const shortcuts = SHORTCUTS[user.role] ?? [];

    const statValue = (key) => {
        if (stats.error) return '—';
        if (stats.data === undefined) return '…';
        return stats.data[key] ?? 0;
    };

    return (
        <div className="instructorTopSection">
            <div className="headerSection flex">
                <div className="title">
                    <h1>Welcome to ODS!</h1>
                    <p>Hello {name}, welcome back!</p>
                </div>

                <div className="searchBar flex">
                    <input type="text" placeholder="Search Dashboard" aria-label="Search dashboard" />
                    <BiSearchAlt className="icon" />
                </div>

                <div className="adminDiv flex">
                    <TbMessageCircle className="icon" />
                    <RiNotificationLine className="icon" />
                    <div className="adminImage">
                        <Avatar {...AVATAR_DEFAULTS} src={user.avatar_url ?? undefined} name={name} className="w-full h-full" />
                    </div>
                </div>
            </div>

            <div className="cardSection flex">
                <div className="rightCard flex">
                    <div className="buttons flex">
                        {shortcuts.map(([path, label], index) => (
                            <button type="button" key={path} className={index === 0 ? 'btn' : 'btn transparent'} onClick={() => navigate(path)}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="videoDiv">
                        <video src={video} autoPlay loop muted playsInline></video>
                    </div>
                </div>

                <div className="leftCard flex">
                    <div className="main flex">
                        <div className="textDiv">
                            <h1>My Stats</h1>
                            <div className="flex">
                                {(STAT_LABELS[user.role] ?? []).map(([key, label]) => (
                                    <span key={key}>
                                        {label} <br /> <small>{statValue(key)}</small>
                                    </span>
                                ))}
                            </div>
                            <button type="button" className="flex link" onClick={() => navigate('/profile/my-profile')}>
                                Edit my profile <BsArrowRightShort className="icon" />
                            </button>
                        </div>
                        <div className="imgDiv">
                            <Avatar {...AVATAR_DEFAULTS} src={user.avatar_url ?? undefined} name={name} className="w-32 h-32 text-large" />
                        </div>
                    </div>
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
        </div>
    );
};

export default Top;
