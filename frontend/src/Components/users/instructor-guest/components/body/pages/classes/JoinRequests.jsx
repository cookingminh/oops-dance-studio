import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LuArrowRight, LuCircleSlash, LuHourglass, LuMusic, LuPartyPopper, LuReceipt, LuSearch, LuSend, LuTicket, LuX } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { useToast } from '@/ui/feedback/toastContext';
import { cancelJoinRequest } from '@/services/classJoin';
import { START_LABELS } from '@/Components/HomePage/Components/Classes/Components/join/joinOffer';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import { ClassThumb } from './ClassParts';
import './joinRequests.scss';

// Reasons the database writes itself (class_join_requests.decline_reason when a class ends): English keys. Staff
// write the others in their own words, shown as they are.
const DB_REASONS = new Set(['The class has ended.']);

const STATUS = {
    pending: { label: 'Waiting for the studio', icon: LuHourglass },
    approved: { label: 'You’re in!', icon: LuPartyPopper },
    declined: { label: 'Not this time', icon: LuCircleSlash },
    cancelled: { label: 'Cancelled', icon: LuX },
};

// One request: the class, when they asked and how they wanted to start, their note or the studio's answer, and
// what they can do next (withdraw it, asked twice · open the class or its invoice · pick another class).
const RequestRow = ({ request, today, classIds, onChanged, onOpenClass }) => {
    const { t, formatDate } = useI18n();
    const toast = useToast();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const keepRef = useRef(null);
    const askRef = useRef(null);
    const focusNext = useRef(null); // 'keep' | 'ask': where the focus goes once the buttons have swapped
    const status = STATUS[request.status] ?? STATUS.pending;
    const StatusIcon = status.icon;
    const cls = request.class ?? { id: request.class_id };
    const asked = formatDate(new Date(request.created_at), 'dayMonth');

    // The buttons swap: the focus follows ("Keep it" when asked, "Cancel request" when kept).
    useEffect(() => {
        const target = { keep: keepRef, ask: askRef }[focusNext.current];
        focusNext.current = null;
        target?.current?.focus();
    }, [confirming]);

    const ask = () => {
        focusNext.current = 'keep';
        setConfirming(true);
    };
    const keep = () => {
        focusNext.current = 'ask';
        setConfirming(false);
    };

    const cancel = async () => {
        setBusy(true);
        try {
            await cancelJoinRequest(request.id);
            toast.success('Request cancelled.');
            await onChanged();
        } catch (error) {
            toast.error(error);
        } finally {
            setBusy(false);
            setConfirming(false);
        }
    };

    let meta = `${t('Asked {date}', { date: asked })} · ${t(START_LABELS[request.start_pref] ?? START_LABELS.now)}`;
    if (request.status === 'approved' && request.joined_at) {
        const date = formatDate(request.joined_at, 'dayMonth');
        meta = request.joined_at >= today ? t('Starts {date}', { date }) : t('Started {date}', { date });
    }

    let actions = null;
    if (request.status === 'pending') {
        actions = confirming ? (
            <div className="jrConfirm" role="group" aria-label={t('Cancel this request?')}>
                <span>{t('Cancel this request?')}</span>
                <button type="button" className="jrAction isDanger" onClick={cancel} disabled={busy}>
                    {busy ? t('Cancelling…') : t('Yes, cancel it')}
                </button>
                <button ref={keepRef} type="button" className="jrAction" onClick={keep} disabled={busy}>
                    {t('Keep it')}
                </button>
            </div>
        ) : (
            <button ref={askRef} type="button" className="jrAction" onClick={ask}>
                {t('Cancel request')}
            </button>
        );
    } else if (request.status === 'approved') {
        actions = (
            <>
                {classIds.has(request.class_id) && (
                    <button type="button" className="jrAction isPrimary" onClick={() => onOpenClass(request.class_id)}>
                        {t('Open the class')} <LuArrowRight aria-hidden="true" />
                    </button>
                )}
                <Link to="/profile/tuition" className="jrAction">
                    <LuReceipt aria-hidden="true" /> {t('See the invoice')}
                </Link>
            </>
        );
    } else {
        actions = (
            <Link to="/classes#all-classes" className="jrAction">
                <LuSearch aria-hidden="true" /> {t('Pick another class')}
            </Link>
        );
    }

    return (
        <li className={`jrRow is-${request.status}`}>
            <ClassThumb cls={cls} className="jrThumb" />
            <div className="jrMain">
                <div className="jrTitle">
                    <strong>{cls.name ?? t('Class')}</strong>
                    {request.teacher && (
                        <span className="jrTeacher">
                            {t('with')} {request.teacher}
                        </span>
                    )}
                </div>
                <span className="jrMeta">{meta}</span>
                {request.status === 'pending' && request.note && <p className="jrNote">“{request.note}”</p>}
                {request.status === 'declined' && request.decline_reason && <p className="jrReason">{DB_REASONS.has(request.decline_reason) ? t(request.decline_reason) : request.decline_reason}</p>}
            </div>
            <div className="jrSide">
                <span className={`jrPill is-${request.status}`}>
                    <StatusIcon aria-hidden="true" /> {t(status.label)}
                </span>
                <div className="jrActions">{actions}</div>
            </div>
        </li>
    );
};

// "Your requests" on My classes (students): asking to join a class, while it waits and for a while after the studio
// answers (joinRequestsData.js). `classIds` are the classes in the tabs below (an approved one opens there).
const JoinRequests = ({ requests, today, classIds, onChanged, onOpenClass }) => {
    const { t, tn } = useI18n();
    const waiting = requests.filter((row) => row.status === 'pending').length;
    const subtitle = waiting
        ? tn(waiting, '{count} request waiting for the studio', '{count} requests waiting for the studio')
        : t('The studio has answered');
    return (
        <SectionCard className="jrCard" icon={LuSend} title={t('Your requests')} subtitle={subtitle}>
            <ul className="jrList">
                {requests.map((request) => (
                    <RequestRow key={request.id} request={request} today={today} classIds={classIds} onChanged={onChanged} onOpenClass={onOpenClass} />
                ))}
            </ul>
        </SectionCard>
    );
};

// My classes without a class yet (students): find one and ask to join, or book a room meanwhile. With a request
// waiting, it says the class shows up here once the studio approves.
export const NoClassesYet = ({ waiting = false }) => {
    const { t } = useI18n();
    return (
        <div className="pfEmpty">
            <span className="pfEmptyArt" aria-hidden="true">
                {waiting ? <LuHourglass /> : <LuMusic />}
            </span>
            <strong>{waiting ? t('Almost there!') : t('Ready for your first class?')}</strong>
            <p>
                {waiting
                    ? t('Your class shows up here as soon as the studio approves your request.')
                    : t('Pick a style you love and come dance with us. Your first class is on the house!')}
            </p>
            <div className="pfEmptyActions">
                <Link to="/classes#all-classes" className="pfBtn isPrimary">
                    <LuSearch aria-hidden="true" /> {waiting ? t('Explore other classes') : t('Find a class and ask to join')}
                </Link>
                <Link to="/rooms" className="pfBtn">
                    <LuTicket aria-hidden="true" /> {t('Book a room')}
                </Link>
            </div>
        </div>
    );
};

export default JoinRequests;
