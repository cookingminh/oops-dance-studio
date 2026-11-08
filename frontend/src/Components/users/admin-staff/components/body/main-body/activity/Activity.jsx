import { useNavigate } from 'react-router-dom';
import { Avatar } from '@nextui-org/react';
import { BsArrowRightShort } from 'react-icons/bs';
import { formatDistanceToNow } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { listRecentCheckins } from '@/services/attendance';
import { avatarUrl } from '@/services/storage';
import AsyncState from '@/ui/feedback/AsyncState';
import './activity.scss';
import { AVATAR_DEFAULTS } from '@/ui/avatar';

// Latest instructor check-ins / check-outs.
const Activity = () => {
    const navigate = useNavigate();
    const recent = useAsync(() => listRecentCheckins(6), []);

    return (
        <div className="activitySection">
            <div className="heading flex">
                <h1>Recent Activity</h1>
                <button type="button" className="btn flex" onClick={() => navigate('/admin/attendance-records')}>
                    See All <BsArrowRightShort className="icon" />
                </button>
            </div>

            <AsyncState state={recent} emptyText="No check-ins yet.">
                {(list) => (
                    <div className="secContainer grid">
                        {list.map((row) => {
                            const name = row.instructor?.full_name || row.instructor?.username || 'Instructor';
                            const checkedOut = Boolean(row.checkout_at);
                            const at = row.checkout_at ?? row.checkin_at;
                            return (
                                <div className="singleUser flex" key={row.id}>
                                    <Avatar {...AVATAR_DEFAULTS}
                                        src={avatarUrl(row.instructor?.avatar_path, row.instructor?.updated_at) ?? undefined}
                                        name={name}
                                    />
                                    <div className="userDetails">
                                        <span className="name">{name}</span>
                                        <small>
                                            {checkedOut ? 'checked out of' : 'checked in to'} {row.class?.name}
                                        </small>
                                    </div>
                                    <div className="duration">{formatDistanceToNow(new Date(at), { addSuffix: true })}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </AsyncState>
        </div>
    );
};

export default Activity;
