import { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@nextui-org/react';
import { LuArrowLeft, LuDoorOpen, LuFlag, LuHistory, LuImage, LuListChecks, LuMoreVertical, LuPencil, LuRotateCcw, LuTrash2, LuUserPlus } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useAuth } from '@/auth/useAuth';
import { ROLES } from '@/auth/roles';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { ClassImage, PhaseBadge, ScheduleChips } from '../HubParts';
import { HUB_BASE, personName } from '../hubModel';
import HubTabs from './HubTabs';
import { useStickyHeader } from './useStickyHeader';
import { activityPath } from '../../activity/activityLinks';

// The class page's sticky header: who / where / when at a glance, the two things staff do most
// (today's roll call, add a student), the rest in ⋮, and the tab row.
const ClassHeader = ({ cls, badge, tabs, tab, onTab, meetsToday, canDelete, actions }) => {
    const { t } = useI18n();
    const heroRef = useRef(null);
    const top = useStickyHeader(heroRef);
    const ended = badge.phase === 'ended';
    const teacher = personName(cls.instructor) || t('No instructor');
    const navigate = useNavigate();
    const { role } = useAuth();

    const menu = [
        !ended && { key: 'edit', label: t('Edit details'), icon: LuPencil, run: actions.edit },
        { key: 'image', label: t('Change image'), icon: LuImage, run: actions.image },
        badge.phase === 'running' || badge.phase === 'upcoming'
            ? { key: 'end', label: t('End class'), icon: LuFlag, run: actions.end }
            : { key: 'reopen', label: t('Reopen class'), icon: LuRotateCcw, run: actions.reopen },
        // Who did what in this class (the Activity page is admin-only).
        role === ROLES.admin && { key: 'activity', label: t('See activity'), icon: LuHistory, run: () => navigate(activityPath({ classId: cls.id })) },
        canDelete && { key: 'delete', label: t('Delete class'), icon: LuTrash2, run: actions.remove, danger: true },
    ].filter(Boolean);

    return (
        <header className="hubSticky" style={{ top }}>
            <div className="hubHeader adminCard">
                <div className="hubHero" ref={heroRef}>
                    <ClassImage cls={cls} className="isHero" />
                    <div className="hubHeroText">
                        <Link to={HUB_BASE} className="hubBack">
                            <LuArrowLeft aria-hidden="true" />
                            {t('All classes')}
                        </Link>
                        <h2 className="hubTitle">
                            <span>{cls.name}</span>
                            <PhaseBadge badge={badge} />
                        </h2>
                        <p className="hubMeta">
                            <span className="hubMetaItem">
                                <Avatar {...AVATAR_DEFAULTS} size="sm" className="hubAvatarXs" src={avatarUrl(cls.instructor?.avatar_path, cls.instructor?.updated_at) ?? undefined} name={teacher} />
                                {teacher}
                            </span>
                            <span className="hubMetaItem">
                                <LuDoorOpen aria-hidden="true" />
                                {cls.room?.name ?? t('No room')}
                            </span>
                            <span className="hubMetaItem">{t('{price} per course', { price: formatVnd(cls.price) })}</span>
                            <ScheduleChips cls={cls} />
                        </p>
                    </div>
                    <div className="hubHeroActions">
                        {meetsToday && !ended && (
                            <Button variant="flat" startContent={<LuListChecks aria-hidden="true" />} onPress={actions.rollCall}>
                                <span className="hubHideSm">{t('Take today’s roll call')}</span>
                                <span className="hubShowSm">{t('Roll call')}</span>
                            </Button>
                        )}
                        {!ended && (
                            <Button color="danger" startContent={<LuUserPlus aria-hidden="true" />} onPress={actions.enrol}>
                                {t('Add student')}
                            </Button>
                        )}
                        <Dropdown placement="bottom-end" classNames={{ content: 'adminPortal' }}>
                            <DropdownTrigger>
                                <Button isIconOnly variant="light" aria-label={t('More for {name}', { name: cls.name })}>
                                    <LuMoreVertical />
                                </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label={t('Class actions')} onAction={(key) => menu.find((item) => item.key === key)?.run()}>
                                {menu.map(({ key, label, icon: Icon, danger }) => (
                                    <DropdownItem key={key} startContent={<Icon aria-hidden="true" />} className={danger ? 'text-danger' : undefined} color={danger ? 'danger' : 'default'}>
                                        {label}
                                    </DropdownItem>
                                ))}
                            </DropdownMenu>
                        </Dropdown>
                    </div>
                </div>
                <HubTabs tabs={tabs} value={tab} onChange={onTab} />
            </div>
        </header>
    );
};

export default ClassHeader;
