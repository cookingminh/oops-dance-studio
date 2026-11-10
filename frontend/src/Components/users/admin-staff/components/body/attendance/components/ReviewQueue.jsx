import { AnimatePresence, motion } from 'framer-motion';
import { Avatar, Button } from '@nextui-org/react';
import { LuAlertTriangle } from 'react-icons/lu';
import { format, parseISO } from 'date-fns';
import { formatClock } from '@/lib/format';
import { avatarUrl } from '@/services/storage';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { useI18n } from '@/i18n/i18nContext';
import SectionCard from '../../../common/SectionCard';
import MakeUpTag from '../../class-manager/routines/MakeUpTag';
import { personName, teacherOf } from '../../../common/session-modal/sessionModel';

// Earlier sessions nobody closed: the instructor never checked in, or never checked out. Mark
// completed if the class happened, cancel it if not; the text opens the whole session.
const ReviewQueue = ({ sessions, busyKey, onApprove, onCancel, onOpen }) => {
    const { t, tn, formatDate } = useI18n();
    return (
        <SectionCard
            className="reviewCard"
            icon={LuAlertTriangle}
            title={t('Needs your review')}
            subtitle={tn(
                sessions.length,
                '{count} past session was never closed. Mark completed if the class happened, cancel it if not.',
                '{count} past sessions were never closed. Mark completed if the class happened, cancel it if not.'
            )}
        >
            <ul className="reviewList">
                <AnimatePresence initial={false}>
                    {sessions.map((session) => {
                        const { row, cls } = session;
                        const name = personName(teacherOf(session)) || t('Instructor');
                        const missing = row.status === 'in_progress' ? t('Checked in {time}, never checked out', { time: formatClock(row.checkin_at) }) : t('No check-in');
                        return (
                            <motion.li key={session.key} layout exit={{ opacity: 0, x: 32 }} transition={{ duration: 0.25 }} className="reviewItem">
                                <span className="reviewDate">
                                    <strong>{format(parseISO(session.date), 'd')}</strong>
                                    <small>{formatDate(session.date, 'monthShort')}</small>
                                </span>
                                <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(teacherOf(session)?.avatar_path, teacherOf(session)?.updated_at) ?? undefined} name={name} />
                                <button type="button" className="reviewText atReviewOpen" onClick={() => onOpen(session)}>
                                    <strong>
                                        {name} · {cls.name}
                                    </strong>
                                    <span>
                                        {formatDate(session.date, 'weekday')} {session.start}–{session.end}
                                        {session.extra && <MakeUpTag className="sessionTag" />} · <em>{missing}</em>
                                    </span>
                                </button>
                                <span className="reviewActions">
                                    <Button size="sm" variant="light" color="danger" onPress={() => onCancel(session)} isDisabled={busyKey === session.key}>
                                        {t('Cancel session')}
                                    </Button>
                                    <Button size="sm" color="success" className="text-white" onPress={() => onApprove(session)} isLoading={busyKey === session.key}>
                                        {t('Mark completed')}
                                    </Button>
                                </span>
                            </motion.li>
                        );
                    })}
                </AnimatePresence>
            </ul>
        </SectionCard>
    );
};

export default ReviewQueue;
