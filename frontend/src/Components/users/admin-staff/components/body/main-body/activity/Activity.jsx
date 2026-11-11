import { Avatar } from '@nextui-org/react';
import { LuActivity, LuLogIn, LuLogOut } from 'react-icons/lu';
import { formatDistanceToNow } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { listRecentCheckins } from '@/services/attendance';
import { avatarUrl } from '@/services/storage';
import AsyncState from '@/ui/feedback/AsyncState';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard, { CardFooterLink } from '../../../common/SectionCard';
import LateTag from '../../../common/checkins/LateTag';

// Latest instructor check-ins / check-outs (a late check-out says so).
const Activity = () => {
    const { t, dateLocale } = useI18n();
    const recent = useAsync(() => listRecentCheckins(5), []);

    return (
        <SectionCard
            className="activityCard"
            icon={LuActivity}
            title={t('Recent Activity')}
            subtitle={t('Instructor check-ins and check-outs')}
            footer={<CardFooterLink to="/admin/attendance">{t('See all attendance records')}</CardFooterLink>}
        >
            <AsyncState state={recent} emptyText={t('No check-ins yet.')}>
                {(list) => (
                    <ul className="activityFeed">
                        {list.map((row) => {
                            const name = row.instructor?.full_name || row.instructor?.username || t('Instructor');
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
                                            <strong>{name}</strong> {checkedOut ? t('checked out of') : t('checked in to')}{' '}
                                            <strong>{row.class?.name}</strong>
                                        </span>
                                        <span className="activityWhen">
                                            <time dateTime={at}>{formatDistanceToNow(new Date(at), { addSuffix: true, locale: dateLocale })}</time>
                                            {checkedOut && row.checkout_late && <LateTag />}
                                        </span>
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
