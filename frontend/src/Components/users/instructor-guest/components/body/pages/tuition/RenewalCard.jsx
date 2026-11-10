import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LuCheck, LuInfo, LuPlay, LuQrCode, LuRepeat, LuUndo2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { amountDue } from '@/services/tuition';
import { clipLength, promoOf } from '@/services/promos';
import PromoDialog from '@/ui/promo/PromoDialog';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import { EASE_OUT } from '../../../../../admin-staff/components/common/motion';
import { isSwitchedAway } from '../../../../../admin-staff/components/common/switch-class/switchNotes';
import { ClassThumb } from '../classes/ClassParts';
import { CourseLine, MovedTo, StatusPill, SwitchedFromLine } from './TuitionParts';
import { canRejoin, canStop, invoiceClass, songOf } from './tuitionData';

const swap = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.22, ease: EASE_OUT } };

// One upcoming course: the question, or the answer and what's next.
const RenewalItem = ({ invoice, all, today, busy, offer, onPay, onAnswer, onStop, onDismissOffer, onWatch }) => {
    const { t, tn, formatDate } = useI18n();
    const title = invoice.course.title || invoice.class_name;
    const vars = {
        className: invoice.class_name,
        course: title,
        start: formatDate(invoice.course.starts_on, 'short'),
        day: formatDate(invoice.course.starts_on, 'dayMonth'),
        date: formatDate(invoice.due_date, 'dayMonth'),
        amount: formatVnd(amountDue(invoice)),
    };
    const isOpen = invoice.status === 'unpaid';
    let state = 'settled';
    if (isOpen) state = invoice.renewal ? 'continuing' : 'ask';
    else if (isSwitchedAway(invoice)) state = 'moved';
    else if (invoice.status === 'void') state = 'cancelled';
    const sessions = invoice.course.session_count;
    // The teacher's clip of the course, to help decide (ask) or to look forward to (continuing).
    const promo = promoOf(invoice.course);
    const watch = promo && (state === 'ask' || state === 'continuing') && (
        <button type="button" className="tuPromoBtn" onClick={() => onWatch(invoice)}>
            <LuPlay aria-hidden="true" />
            {t('Watch the promo')}
            {promo.seconds ? <span>{clipLength(promo.seconds)}</span> : null}
        </button>
    );

    return (
        <li className={`tuRenew is-${state}`}>
            <ClassThumb cls={invoiceClass(invoice)} />
            <AnimatePresence mode="wait" initial={false}>
                <motion.div key={state} className="tuRenewBody" {...swap}>
                    {state === 'ask' && (
                        <>
                            <strong className="tuRenewQ">{t('Continue with {course} (starts {start})?', vars)}</strong>
                            <small>
                                {invoice.class_name}
                                {sessions != null && ` · ${tn(sessions, '{count} session', '{count} sessions')}`} · {t('{amount} · answer by {date}', vars)}
                            </small>
                            <SwitchedFromLine invoice={invoice} invoices={all} />
                            {watch}
                            <div className="tuRenewActions">
                                <button type="button" className="pfBtn isPrimary isSmall" onClick={() => onAnswer(invoice, 'continue')} disabled={busy}>
                                    <LuCheck aria-hidden="true" /> {t('Continue')}
                                </button>
                                {canStop(invoice) && (
                                    <button type="button" className="pfBtn isSmall" onClick={() => onStop(invoice)} disabled={busy}>
                                        {invoice.previous ? t('Stop after {course}', { course: songOf(invoice.previous) }) : t('Don’t continue')}
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                    {state === 'continuing' && (
                        <>
                            <strong>
                                {title}
                                <span className="tuPill tone-good">
                                    <LuCheck aria-hidden="true" /> {t('Continuing')}
                                </span>
                            </strong>
                            <small>
                                <CourseLine invoice={invoice} />
                            </small>
                            <small>{t('{amount} to pay by {date}', vars)}</small>
                            <SwitchedFromLine invoice={invoice} invoices={all} />
                            {watch}
                            {offer && (
                                <p className="tuOffer" role="status">
                                    {t('Lovely! Want to pay now? It takes one scan.')}
                                </p>
                            )}
                            <div className="tuRenewActions">
                                <button type="button" className={`pfBtn isPrimary isSmall${offer ? ' isGlow' : ''}`} onClick={() => onPay(invoice)}>
                                    <LuQrCode aria-hidden="true" /> {t('Pay now')}
                                    <span className="sr-only"> {invoice.class_name}</span>
                                </button>
                                {offer ? (
                                    <button type="button" className="tuLinkBtn" onClick={onDismissOffer}>
                                        {t('Later')}
                                    </button>
                                ) : (
                                    canStop(invoice) && (
                                        <button type="button" className="tuLinkBtn" onClick={() => onStop(invoice)} disabled={busy}>
                                            {t('Change my mind')}
                                        </button>
                                    )
                                )}
                            </div>
                        </>
                    )}
                    {state === 'moved' && (
                        <>
                            <strong>
                                {title}
                                <StatusPill invoice={invoice} today={today} />
                            </strong>
                            <small>
                                <CourseLine invoice={invoice} />
                            </small>
                            <small>
                                <MovedTo invoice={invoice} invoices={all} />
                            </small>
                        </>
                    )}
                    {state === 'cancelled' && (
                        <>
                            <strong>
                                {title}
                                <StatusPill invoice={invoice} today={today} />
                            </strong>
                            <small>
                                <CourseLine invoice={invoice} />
                            </small>
                            <small>
                                {invoice.void_reason === 'removed'
                                    ? t('The studio took you off this class.')
                                    : invoice.void_reason === 'class_ended'
                                        ? t('The class ends before this course.')
                                        : t('You’ll leave {className} when {course} starts.', vars)}
                            </small>
                            {canRejoin(invoice) && (
                                <div className="tuRenewActions">
                                    <button type="button" className="pfBtn isSmall" onClick={() => onAnswer(invoice, 'continue')} disabled={busy}>
                                        <LuUndo2 aria-hidden="true" /> {t('Continue after all')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                    {state === 'settled' && (
                        <>
                            <strong>
                                {title}
                                <StatusPill invoice={invoice} today={today} />
                            </strong>
                            <small>
                                <CourseLine invoice={invoice} />
                            </small>
                            <small>{invoice.status === 'waived' ? t('The studio waived this course. Enjoy!') : t('All set. See you on {day}!', vars)}</small>
                            <SwitchedFromLine invoice={invoice} invoices={all} />
                        </>
                    )}
                </motion.div>
            </AnimatePresence>
        </li>
    );
};

// The courses that haven't started yet: per class "continue with the next course or stop?", with the
// deadline rule spelled out.
const RenewalCard = ({ invoices, all, today, busyId, offerId, onPay, onAnswer, onStop, onDismissOffer }) => {
    const { t, tn, formatDate } = useI18n();
    const [watching, setWatching] = useState(null); // the invoice whose course promo is playing
    const open = invoices.filter((invoice) => invoice.status === 'unpaid');
    const waiting = open.filter((invoice) => !invoice.renewal).length;
    const deadline = open.map((invoice) => invoice.due_date).sort()[0];
    const date = deadline && formatDate(deadline, 'dayMonth');

    return (
        <SectionCard
            className="tuRenewCard"
            icon={LuRepeat}
            title={tn(invoices.length, 'Your next course', 'Your next courses')}
            subtitle={waiting ? tn(waiting, '{count} course waiting for your answer', '{count} courses waiting for your answer') : t('All answered. Thank you!')}
        >
            {deadline && (
                <p className="tuRule">
                    <LuInfo aria-hidden="true" />
                    <span>{t('Answer or pay by {date}. Paying counts as continuing. Still unpaid with no answer after {date}? Your place in the class ends then.', { date })}</span>
                </p>
            )}
            <ul className="tuRenewList">
                {invoices.map((invoice) => (
                    <RenewalItem
                        key={invoice.id}
                        invoice={invoice}
                        all={all}
                        today={today}
                        busy={busyId === invoice.id}
                        offer={offerId === invoice.id}
                        onPay={onPay}
                        onAnswer={onAnswer}
                        onStop={onStop}
                        onDismissOffer={onDismissOffer}
                        onWatch={setWatching}
                    />
                ))}
            </ul>
            {watching && (
                <PromoDialog
                    promo={promoOf(watching.course)}
                    portalClass="adminPortal"
                    eyebrow={`${t('Your next course')} · ${watching.class_name}`}
                    title={watching.course.title || watching.class_name}
                    meta={t('From {date}', { date: formatDate(watching.course.starts_on, 'short') })}
                    onClose={() => setWatching(null)}
                />
            )}
        </SectionCard>
    );
};

export default RenewalCard;
