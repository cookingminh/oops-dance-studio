import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, Button } from '@nextui-org/react';
import { LuCalendarClock, LuCheck, LuClock, LuHistory, LuMail, LuPhone, LuSparkles, LuUsers, LuX } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { levelOf } from '@/lib/classLevel';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { fadeUp } from '../../common/motion';
import { LevelDot } from '../../common/LevelField';
import { ClassImage, ScheduleChips } from '../class-hub/HubParts';
import { classPath } from '../class-hub/hubModel';
import { START_LABELS, STATUS, askedText, isLate, lateText, personName, studioDateOf } from './joinModel';

const tel = (number) => `tel:${number.replace(/[^\d+]/g, '')}`;

// "New to the studio", "Also in Kpop 1, Hiphop Kids" or "Took Choreo Bà Triệu before" — from their places and invoices.
export const StudentHistory = ({ classes }) => {
    const { t } = useI18n();
    const names = (list) => list.map((cls) => cls.name).join(', ');
    if (classes?.current?.length) {
        return (
            <span className="jrHistory isMember">
                <LuUsers aria-hidden="true" />
                {t('Also in {classes}', { classes: names(classes.current) })}
            </span>
        );
    }
    if (classes?.past?.length) {
        return (
            <span className="jrHistory isPast">
                <LuHistory aria-hidden="true" />
                {t('Took {classes} before', { classes: names(classes.past) })}
            </span>
        );
    }
    return (
        <span className="jrHistory isNew">
            <LuSparkles aria-hidden="true" />
            {t('New to the studio')}
        </span>
    );
};

// The student: photo, name, how to reach them and whether they know the studio.
const Who = ({ student, classes }) => {
    const name = personName(student);
    return (
        <div className="jrWho">
            <Avatar {...AVATAR_DEFAULTS} className="jrAvatar" src={avatarUrl(student?.avatar_path, student?.updated_at) ?? undefined} name={name} />
            <span className="jrWhoText">
                <strong className="jrName">{name}</strong>
                <span className="jrContact">
                    {student?.contact_number && (
                        <a href={tel(student.contact_number)}>
                            <LuPhone aria-hidden="true" />
                            {student.contact_number}
                        </a>
                    )}
                    {student?.email && (
                        <span title={student.email}>
                            <LuMail aria-hidden="true" />
                            {student.email}
                        </span>
                    )}
                </span>
                <StudentHistory classes={classes} />
            </span>
        </div>
    );
};

// The class asked for: its picture, name and level, teacher and weekly times, its places left when it has a maximum
// (`seats`); opens its Students tab.
const ClassBlock = ({ cls, start, seats }) => {
    const { t, tn } = useI18n();
    if (!cls) return null;
    const teacher = personName(cls.instructor) || t('No instructor');
    return (
        <div className="jrClass">
            <ClassImage cls={cls} className="jrThumb" />
            <span className="jrClassText">
                <span className="jrClassTitle">
                    <Link to={classPath(cls.id, { tab: 'students' })} className="jrClassName">
                        {cls.name}
                    </Link>
                    {cls.level && (
                        <span className="hubTag hubLevelTag">
                            <LevelDot value={cls.level} />
                            {t(levelOf(cls.level).label)}
                        </span>
                    )}
                    {seats && (
                        <span className={`hubTag jrSeatsTag${seats.full ? ' isFull' : ''}`}>
                            {seats.full ? t('Full · {taken}/{max}', seats) : tn(seats.left, '{count} place left', '{count} places left')}
                        </span>
                    )}
                </span>
                <span className="jrTeacher">
                    <Avatar {...AVATAR_DEFAULTS} size="sm" className="hubAvatarXs" src={avatarUrl(cls.instructor?.avatar_path, cls.instructor?.updated_at) ?? undefined} name={teacher} />
                    {teacher}
                </span>
                <ScheduleChips cls={cls} />
                {start && (
                    <span className="jrStart">
                        <LuCalendarClock aria-hidden="true" />
                        {t(START_LABELS[start] ?? START_LABELS.now)}
                    </span>
                )}
            </span>
        </div>
    );
};

// How an answered request ended: the status, who decided and when, the reason, the start date.
const Decision = ({ request }) => {
    const { t, formatDate } = useI18n();
    const status = STATUS[request.status] ?? STATUS.declined;
    const by = personName(request.decider);
    const date = request.decided_at ? formatDate(studioDateOf(request.decided_at), 'short') : '';
    // A cancelled request names nobody: decided_by is the student who cancelled it.
    const line = request.status !== 'cancelled' && by ? t('Answered by {name} · {date}', { name: by, date }) : date;
    return (
        <div className="jrDecision">
            <span className={`phaseBadge tone-${status.tone}`}>{t(status.label)}</span>
            <small>{line}</small>
            {request.status === 'approved' && request.joined_at && (
                <span className="jrDecisionFact">
                    <LuCalendarClock aria-hidden="true" />
                    {t('In the class from {date}', { date: formatDate(request.joined_at, 'dayMonth') })}
                </span>
            )}
        </div>
    );
};

// One request on the Join requests page. Waiting: actions to approve or decline it; answered: how it ended.
const JoinRequestCard = ({ request, seats = null, now, onApprove, onDecline }) => {
    const i18n = useI18n();
    const { t } = i18n;
    const waiting = request.status === 'pending';
    const late = isLate(request, now);
    return (
        <motion.li variants={fadeUp} layout="position" className={`jrCard${late ? ' isLate' : ''}${waiting ? '' : ` is-${request.status}`}`}>
            <Who student={request.student} classes={request.classes} />
            <ClassBlock cls={request.class} start={request.start_pref} seats={request.status === 'pending' ? seats : null} />

            <div className="jrSide">
                {!waiting && <Decision request={request} />}
                <span className="jrWhen">
                    {late && <span className="jrLateTag">{lateText(request, i18n, now)}</span>}
                    <span className="jrAsked">
                        <LuClock aria-hidden="true" />
                        {askedText(request.created_at, i18n, now)}
                    </span>
                </span>
                {waiting && (
                    <span className="jrActions">
                        <Button variant="light" startContent={<LuX aria-hidden="true" />} onPress={() => onDecline(request)} aria-label={t('Decline {name}', { name: personName(request.student) })}>
                            {t('Decline')}
                        </Button>
                        <Button color="danger" startContent={<LuCheck aria-hidden="true" />} onPress={() => onApprove(request)} aria-label={t('Approve {name}', { name: personName(request.student) })}>
                            {t('Approve')}
                        </Button>
                    </span>
                )}
            </div>

            {(request.note || request.decline_reason) && (
                <div className="jrWords">
                    {request.note && <blockquote className="jrQuote">“{request.note}”</blockquote>}
                    {request.status === 'declined' && request.decline_reason && (
                        <p className="jrReason">
                            <strong>{t('Reason:')}</strong> {t(request.decline_reason)}
                        </p>
                    )}
                </div>
            )}
        </motion.li>
    );
};

export default JoinRequestCard;
