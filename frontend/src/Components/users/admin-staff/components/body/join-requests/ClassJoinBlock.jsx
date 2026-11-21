import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, Button } from '@nextui-org/react';
import { LuArrowRight, LuCalendarClock, LuCheck, LuClock, LuPhone, LuUserPlus, LuX } from 'react-icons/lu';
import { useAsync } from '@/hooks/useAsync';
import { listJoinRequests } from '@/services/classJoinStaff';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import SectionCard from '../../common/SectionCard';
import { fadeUp, stagger } from '../../common/motion';
import { StudentHistory } from './JoinRequestCard';
import JoinDialogs from './JoinDialogs';
import { JOIN_PAGE, START_LABELS, askedText, isLate, lateText, personName } from './joinModel';
import './joinRequests.scss';

// The class page's Students tab: students waiting to join this class, above the list, with Approve / Decline (the
// Join requests page's dialogs). Hidden when nobody is waiting. After an answer the class reloads (ctx.changed), so
// an approved student shows up in the list right away.
const ClassJoinBlock = ({ ctx }) => {
    const { cls, version, changed } = ctx;
    const i18n = useI18n();
    const { t } = i18n;
    const requests = useAsync(() => listJoinRequests({ status: 'pending', classId: cls.id }), [cls.id, version]);
    const [dialog, setDialog] = useState(null);
    const rows = requests.data ?? [];
    if (rows.length === 0) return null;
    const now = Date.now();

    return (
        <>
            <SectionCard
                icon={LuUserPlus}
                className="jrHubBlock"
                title={t('Waiting to join ({count})', { count: rows.length })}
                subtitle={t('They asked on the website. Approve to add them to the class: they are billed as usual.')}
                actions={
                    <Link to={`${JOIN_PAGE}?class=${cls.id}`} className="cardLink">
                        {t('All join requests')}
                        <LuArrowRight aria-hidden="true" />
                    </Link>
                }
            >
                <motion.ul className="jrHubRows" variants={stagger} initial="hidden" animate="show" aria-label={t('Waiting to join')}>
                    {rows.map((request) => {
                        const name = personName(request.student);
                        const late = isLate(request, now);
                        return (
                            <motion.li key={request.id} variants={fadeUp} className={`jrHubRow${late ? ' isLate' : ''}`}>
                                <span className="jrHubWho">
                                    <Avatar {...AVATAR_DEFAULTS} size="sm" src={avatarUrl(request.student?.avatar_path, request.student?.updated_at) ?? undefined} name={name} />
                                    <span>
                                        <strong>{name}</strong>
                                        {request.student?.contact_number ? (
                                            <a className="hubTel" href={`tel:${request.student.contact_number.replace(/[^\d+]/g, '')}`}>
                                                <LuPhone aria-hidden="true" />
                                                {request.student.contact_number}
                                            </a>
                                        ) : (
                                            <small>{request.student?.email}</small>
                                        )}
                                    </span>
                                </span>
                                <span className="jrHubFacts">
                                    <span className="jrStart">
                                        <LuCalendarClock aria-hidden="true" />
                                        {t(START_LABELS[request.start_pref] ?? START_LABELS.now)}
                                    </span>
                                    {late ? (
                                        <span className="jrLateTag">{lateText(request, i18n, now)}</span>
                                    ) : (
                                        <span className="jrAsked">
                                            <LuClock aria-hidden="true" />
                                            {askedText(request.created_at, i18n, now)}
                                        </span>
                                    )}
                                    <StudentHistory classes={request.classes} />
                                </span>
                                {request.note && (
                                    <span className="jrHubNote" title={request.note}>
                                        “{request.note}”
                                    </span>
                                )}
                                <span className="jrHubActions">
                                    <Button size="sm" variant="light" startContent={<LuX aria-hidden="true" />} onPress={() => setDialog({ kind: 'decline', request })} aria-label={t('Decline {name}', { name })}>
                                        {t('Decline')}
                                    </Button>
                                    <Button size="sm" color="danger" startContent={<LuCheck aria-hidden="true" />} onPress={() => setDialog({ kind: 'approve', request })} aria-label={t('Approve {name}', { name })}>
                                        {t('Approve')}
                                    </Button>
                                </span>
                            </motion.li>
                        );
                    })}
                </motion.ul>
            </SectionCard>

            <JoinDialogs
                dialog={dialog}
                onClose={() => setDialog(null)}
                onDone={() => {
                    setDialog(null);
                    changed();
                }}
            />
        </>
    );
};

export default ClassJoinBlock;
