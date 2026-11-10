import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { LuMusic } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { fadeUp } from '../../../common/motion';
import { ClassImage, FlagChips, MiniBar, PhaseBadge, ScheduleChips } from '../HubParts';
import { classPath, percent, personName } from '../hubModel';

const Stat = ({ label, value, hint }) => (
    <span className="hubStat">
        <small>{label}</small>
        <strong>{value}</strong>
        {hint && <em>{hint}</em>}
    </span>
);

// The numbers a card shows depend on the view: this month's running, the opening of an upcoming
// class, or the history of a past one. Margin and revenue only for admins.
const CardStats = ({ item, view, isAdmin }) => {
    const { t, tn, formatDate } = useI18n();
    const { cls, tuition } = item;
    if (view === 'upcoming') {
        return (
            <div className="hubStats">
                <Stat label={t('Opens')} value={formatDate(cls.starts_on, 'dayMonth')} />
                <Stat label={t('Signed up')} value={item.students} />
                <Stat label={t('Price')} value={formatVnd(cls.price)} />
            </div>
        );
    }
    if (view === 'past') {
        return (
            <div className="hubStats">
                <span className="hubStat isWide">
                    <small>{t('Ran')}</small>
                    <strong>{`${formatDate(cls.starts_on, 'dayMonth')} – ${formatDate(cls.ended_on, 'dayMonth')}`}</strong>
                </span>
                <Stat label={t('Students')} value={item.past.students} />
                <Stat label={t('Sessions taught')} value={item.past.sessions} />
                {isAdmin && <Stat label={t('Revenue')} value={formatVnd(item.past.revenue)} />}
            </div>
        );
    }
    return (
        <div className="hubStats">
            <Stat label={t('Students')} value={item.students} />
            <Stat label={t('Paid')} value={tuition.count ? `${tuition.settled}/${tuition.count}` : '—'} hint={item.course ? t('this course') : undefined} />
            <Stat label={t('Sessions')} value={`${item.held}/${item.planned}`} hint={t('this month')} />
            <Stat label={t('Attendance')} value={percent(item.attendance)} />
            {isAdmin && <Stat label={t('Margin')} value={item.margin === null ? '—' : formatVnd(item.margin)} />}
            {item.routine.current && (
                <span className="hubStat isWide">
                    <small>
                        <LuMusic aria-hidden="true" /> {item.routine.current.title}
                    </small>
                    <MiniBar
                        value={item.routine.current.sessions_held / item.routine.current.session_count}
                        label={t('{title}: {held} of {total} sessions', { title: item.routine.current.title, held: item.routine.current.sessions_held, total: item.routine.current.session_count })}
                    />
                    <em>{tn(item.routine.current.session_count, '{held} of {count} session', '{held} of {count} sessions', { held: item.routine.current.sessions_held })}</em>
                </span>
            )}
        </div>
    );
};

// One class in the directory: photo, name, phase, instructor, weekly times, the view's numbers and
// what needs attention. The whole card opens the class page.
const ClassCard = ({ item, view, isAdmin }) => {
    const { t } = useI18n();
    const { cls } = item;
    const teacher = personName(cls.instructor) || t('No instructor');
    return (
        <motion.li variants={fadeUp} className="hubCardItem">
            <Link to={classPath(cls.id)} className={`hubCard is-${item.phase}`} aria-label={cls.name}>
                <span className="hubCardMedia">
                    <ClassImage cls={cls} />
                    <PhaseBadge badge={item.badge} className="onImage" />
                    {cls.room && <span className="hubRoomTag">{cls.room.name}</span>}
                </span>
                <span className="hubCardBody">
                    <span className="hubCardTitle">
                        <strong>{cls.name}</strong>
                    </span>
                    <span className="hubTeacher">
                        <Avatar {...AVATAR_DEFAULTS} size="sm" className="hubAvatarXs" src={avatarUrl(cls.instructor?.avatar_path, cls.instructor?.updated_at) ?? undefined} name={teacher} />
                        {teacher}
                    </span>
                    <ScheduleChips cls={cls} empty={<span className="hubSlot isEmpty">{t('No weekly sessions yet')}</span>} />
                    <CardStats item={item} view={view} isAdmin={isAdmin} />
                    <FlagChips flags={item.flags} />
                </span>
            </Link>
        </motion.li>
    );
};

export default ClassCard;
