import { useNavigate } from 'react-router-dom';
import { BiSearchAlt } from 'react-icons/bi';
import { TbMessageCircle } from 'react-icons/tb';
import { BsQuestionCircle } from 'react-icons/bs';
import { RiNotificationLine } from 'react-icons/ri';
import { Avatar } from '@nextui-org/react';
import { useAuth } from '@/auth/useAuth';
import { useAsync } from '@/hooks/useAsync';
import { dashboardStats } from '@/services/stats';
import { formatVnd } from '@/lib/format';
import './top.scss';
import video from '@/assets/video/dashboard.mp4';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

const Top = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const stats = useAsync(dashboardStats, []);

    const value = (key, format = (v) => v) => {
        if (stats.error) return '—';
        if (stats.data === undefined) return '…';
        return format(stats.data[key] ?? 0);
    };
    const rows = [
        { label: 'Bookings this month:', value: value('monthly_booking_count') },
        { label: 'Enrolled students:', value: value('total_students') },
        { label: 'Classes today:', value: value('classes_today') },
        { label: 'Revenue this month:', value: value('revenue_this_month', formatVnd) },
    ];

    return (
        <div className="adminTopSection">
            <div className="headerSection flex">
                <div className="title">
                    <h1>Welcome to ODS!</h1>
                    <p>Hello {user.full_name || user.username}, welcome back!</p>
                </div>

                <div className="searchBar flex">
                    <input type="text" placeholder="Search Dashboard" aria-label="Search dashboard" />
                    <BiSearchAlt className="icon" />
                </div>

                <div className="adminDiv flex">
                    <TbMessageCircle className="icon" />
                    <RiNotificationLine className="icon" />
                    <div className="adminImage">
                        <Avatar {...AVATAR_DEFAULTS} src={user.avatar_url ?? undefined} name={user.full_name || user.username} className="w-full h-full" />
                    </div>
                </div>
            </div>

            <div className="cardSection flex">
                <div className="rightCard flex">
                    <div className="buttons flex">
                        <button type="button" onClick={() => navigate('/admin/attendance-records')} className="btn">Attendance List</button>
                        <button type="button" onClick={() => navigate('/admin/charts')} className="btn transparent">Charts</button>
                    </div>
                    <div className="videoDiv">
                        <video src={video} autoPlay loop muted playsInline></video>
                    </div>
                </div>

                <div className="leftCard flex">
                    <div className="main flex">
                        <div className="textDiv">
                            <h1>Studio Stats</h1>
                            <div className="studioStats">
                                {rows.map((row, index) => (
                                    <span key={row.label} className={`${index % 2 === 0 ? 'rooms' : 'participants'} flex flex-row`}>
                                        <div className="title">
                                            <h3>{row.label}</h3>
                                        </div>
                                        <div className={index % 2 === 0 ? 'roomsStatus' : 'participantsStatus'}>
                                            <small>{row.value}</small>
                                        </div>
                                    </span>
                                ))}
                            </div>
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
