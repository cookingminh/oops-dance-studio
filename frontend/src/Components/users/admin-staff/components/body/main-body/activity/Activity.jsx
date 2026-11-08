import { Avatar } from '@nextui-org/react';
import { LuActivity, LuLogIn, LuLogOut } from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { listRecentCheckins } from '@/services/attendance';
import { avatarUrl } from '@/services/storage';
import AsyncState from '@/ui/feedback/AsyncState';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';

// Latest instructor check-ins / check-outs.
const Activity = () => {
    const recent = useAsync(() => listRecentCheckins(5), []);

    return (
        <SectionCard
            className="activityCard"
            icon={LuActivity}
            title="Recent Activity"
            subtitle="Instructor check-ins and check-outs"
            footer={<CardFooterLink to="/admin/attendance-records">See all attendance records</CardFooterLink>}
        >
            <AsyncState state={recent} emptyText="No check-ins yet.">
                {(list) => (
                    <ul className="activityFeed">
                        {list.map((row) => {
                            const name = row.instructor?.full_name || row.instructor?.username || 'Instructor';
                            const checkedOut = Boolean(row.checkout_at);
                            const at = row.checkout_at ?? row.checkin_at;
                            const Icon = checkedOut ? LuLogOut : LuLogIn;
                            return (
                                <li className="activityItem" key={row.id}>
                                    <span className="activityAvatar">
                                        <Avatar
                                            {...AVATAR_DEFAULTS}
                                            size="sm"
                                            src={avatarUrl(row.instructor?.avatar_path, row.instructor?.updated_at) ?? undefined}
                                            name={name}
                                        />
                                        <span className={`activityBadge ${checkedOut ? 'isOut' : 'isIn'}`} aria-hidden="true">
                                            <Icon />
                                        </span>
                                    </span>
                                    <div className="activityText">
                                        <span>
                                            <strong>{name}</strong> {checkedOut ? 'checked out of' : 'checked in to'}{' '}
                                            <strong>{row.class?.name}</strong>
                                        </span>
                                        <time dateTime={at}>{formatDistanceToNow(new Date(at), { addSuffix: true })}</time>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </AsyncState>
        </SectionCard>
    );
};

export default Activity;
