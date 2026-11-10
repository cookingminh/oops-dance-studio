import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar } from '@nextui-org/react';
import { LuClipboardCheck, LuListChecks } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import LinkButton from '@/ui/LinkButton';
import { fadeUp, stagger } from '../../../common/motion';
import { ClassImage, MiniBar } from '../HubParts';
import { classPath, personName } from '../hubModel';

// Today's classes in time order: when and where, who teaches (a substitute is marked), the
// instructor's check-in, the roll call so far and the two things staff do from here.
const TodayList = ({ items, today }) => {
    const { t } = useI18n();
    return (
        <motion.ol className="hubToday" variants={stagger} initial="hidden" animate="show" aria-label={t('Today’s classes')}>
            {items.map((item) => {
                const { cls, state } = item;
                const teacher = personName(item.teacher) || t('No instructor');
                const sessionLink = classPath(cls.id, { tab: 'sessions', day: today });
                const review = state.kind === 'review';
                return (
                    <motion.li key={cls.id} variants={fadeUp} className={`hubTodayRow tone-${state.tone}`}>
                        <span className="hubTodayTime">
                            <strong>{item.start || '—'}</strong>
                            <small>{item.end}</small>
                        </span>
                        <ClassImage cls={cls} className="isThumb" />
                        <span className="hubTodayMain">
                            <Link to={classPath(cls.id)} className="hubTodayName">
                                {cls.name}
                            </Link>
                            <span className="hubTodayMeta">
                                <Avatar {...AVATAR_DEFAULTS} size="sm" className="hubAvatarXs" src={avatarUrl(item.teacher?.avatar_path, item.teacher?.updated_at) ?? undefined} name={teacher} />
                                <span>{teacher}</span>
                                {item.substitute && <span className="hubTag">{t('Substitute')}</span>}
                                {cls.room?.name && <span>· {cls.room.name}</span>}
                                {item.row?.is_extra && <span className="hubTag isMakeUp">{t('Make-up')}</span>}
                            </span>
                        </span>
                        <span className="hubTodayCheck">
                            <small>{t('Check-in')}</small>
                            <span className={`phaseBadge tone-${state.tone}`}>
                                {state.tone === 'live' && <span className="livePulse" aria-hidden="true" />}
                                {t(state.key, state.vars)}
                            </span>
                        </span>
                        <span className="hubTodayRoll">
                            <small>{t('Roll call')}</small>
                            {item.rollTotal ? (
                                <>
                                    <strong>{t('{done}/{total} marked', { done: item.marked, total: item.rollTotal })}</strong>
                                    <MiniBar
                                        value={item.marked / item.rollTotal}
                                        tone={item.marked === item.rollTotal ? 'good' : 'brand'}
                                        label={t('{name}: roll call marked', { name: cls.name })}
                                    />
                                </>
                            ) : (
                                <strong className="isMuted">{t('Not created yet')}</strong>
                            )}
                        </span>
                        <span className="hubTodayActions">
                            {review && (
                                <LinkButton to={sessionLink} size="sm" variant="flat" startContent={<LuClipboardCheck aria-hidden="true" />}>
                                    {t('Review check-in')}
                                </LinkButton>
                            )}
                            {state.kind !== 'cancelled' && (
                                <LinkButton
                                    to={sessionLink}
                                    size="sm"
                                    variant={item.rollTotal && item.marked === item.rollTotal ? 'light' : 'solid'}
                                    startContent={<LuListChecks aria-hidden="true" />}
                                    aria-label={t('Take the roll call for {name}', { name: cls.name })}
                                >
                                    {t('Take roll call')}
                                </LinkButton>
                            )}
                        </span>
                    </motion.li>
                );
            })}
        </motion.ol>
    );
};

export default TodayList;
