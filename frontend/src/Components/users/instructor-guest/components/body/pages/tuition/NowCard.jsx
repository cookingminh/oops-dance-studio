import { LuBanknote, LuCalendarClock, LuLogOut, LuQrCode, LuReceipt, LuUndo2 } from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { amountDue } from '@/services/tuition';
import SectionCard from '../../../../../admin-staff/components/common/SectionCard';
import { switchedInto } from '../../../../../admin-staff/components/common/switch-class/switchNotes';
import { ClassThumb } from '../classes/ClassParts';
import { CourseLine, MovedTo, SessionPips, StatusPill, SwitchedFromLine } from './TuitionParts';
import { canRejoin, canStop, invoiceClass, joinedLate, needsAnswer, songOf, studioDay } from './tuitionData';

// One small line under the course, so the row says what happened in words.
function rowDetail(invoice, today, all, { t, formatDate }) {
    switch (invoice.status) {
        case 'paid':
            return invoice.method === 'cash'
                ? t('Paid in cash on {date}', { date: formatDate(studioDay(invoice.paid_at), 'dayMonth') })
                : t('Paid by bank transfer on {date}', { date: formatDate(studioDay(invoice.paid_at), 'dayMonth') });
        case 'waived':
            return t('The studio waived this course. Enjoy!');
        case 'void':
            if (invoice.void_reason === 'switched') return <MovedTo invoice={invoice} invoices={all} />;
            if (invoice.void_reason === 'stopped') return t('You stopped this class.');
            if (invoice.void_reason === 'not_renewed') return t('It wasn’t paid or answered in time, so your place ended.');
            if (invoice.void_reason === 'class_ended') return t('The class ended before this course.');
            return t('The studio took you off this class.');
        default:
            if (Number(invoice.paid_amount) > 0) return t('{paid} paid · {due} left', { paid: formatVnd(invoice.paid_amount), due: formatVnd(amountDue(invoice)) });
            if (invoice.due_date < today) return t('Was due {date}. Please pay when you can.', { date: formatDate(invoice.due_date, 'dayMonth') });
            return t('Pay by QR in a few seconds, or in cash at the desk.');
    }
}

// Notes in plain words: a late join (paid for fewer sessions) and a planned leave (class switch).
const RowNotes = ({ invoice, all, place }) => {
    const { t, formatDate } = useI18n();
    const notes = [];
    if (joinedLate(invoice) && invoice.status !== 'void') {
        const count = Number(invoice.course.session_count);
        const left = Number(invoice.sessions);
        notes.push({
            key: 'late',
            icon: LuCalendarClock,
            text: t('You joined after {held} of {count} sessions, so you pay only for the {left} left.', { held: count - left, count, left }),
        });
    }
    if (place?.leaves_after && invoice.status !== 'void') {
        const next = switchedInto(invoice, all);
        const date = formatDate(place.leaves_after, 'short');
        notes.push({
            key: 'leave',
            icon: LuLogOut,
            text: next
                ? t('Your last session here is {date}, then you move to {className}.', { date, className: next.class_name })
                : t('Your last session here is {date}, then you leave this class.', { date }),
        });
    }
    return notes.map(({ key, icon: Icon, text }) => (
        <span key={key} className="tuNoteLine">
            <Icon aria-hidden="true" />
            <span>{text}</span>
        </span>
    ));
};

const InvoiceRow = ({ invoice, all, place, today, busy, onPay, onAnswer, onStop }) => {
    const i18n = useI18n();
    const { t, formatDate } = i18n;
    const isFinished = invoice.course.phase === 'done';
    const asks = needsAnswer(invoice) && invoice.due_date >= today;
    const title = invoice.course.title || invoice.class_name;

    return (
        <li className={`tuRow${invoice.status === 'void' ? ' isMuted' : ''}${invoice.void_reason === 'switched' ? ' isMoved' : ''}`}>
            <ClassThumb cls={invoiceClass(invoice)} />
            <div className="tuRowMain">
                <strong>
                    <span className="tuRowTitle">{title}</span>
                    {isFinished && <span className="tuRowMonth">{t('Course finished')}</span>}
                </strong>
                <CourseLine invoice={invoice} />
                {invoice.course.phase === 'current' && invoice.status !== 'void' && <SessionPips course={invoice.course} />}
                <small>{rowDetail(invoice, today, all, i18n)}</small>
                <RowNotes invoice={invoice} all={all} place={place} />
                <SwitchedFromLine invoice={invoice} invoices={all} />
            </div>
            <span className="tuRowEnd">
                <span className="tuRowAmount">{formatVnd(invoice.amount)}</span>
                <StatusPill invoice={invoice} today={today} />
            </span>
            <div className="tuRowAction">
                {invoice.status === 'unpaid' && (
                    <button type="button" className="pfBtn isPrimary isSmall" onClick={() => onPay(invoice)}>
                        <LuQrCode aria-hidden="true" /> {t('Pay now')}
                        <span className="sr-only"> {invoice.class_name}</span>
                    </button>
                )}
                {canRejoin(invoice) && (
                    <button type="button" className="pfBtn isSmall" onClick={() => onAnswer(invoice, 'continue')} disabled={busy}>
                        <LuUndo2 aria-hidden="true" /> {t('Continue after all')}
                    </button>
                )}
            </div>
            {/* A member of the last course who hasn't paid or answered: one tap keeps the place (or frees it). */}
            {asks && (
                <div className="tuAsk">
                    <p>
                        {t('Still dancing {course}? Pay or tell us by {date}, or your place in this class ends then.', {
                            course: songOf(title),
                            date: formatDate(invoice.due_date, 'dayMonth'),
                        })}
                    </p>
                    <div className="tuAskActions">
                        <button type="button" className="tuLinkBtn isGood" onClick={() => onAnswer(invoice, 'continue')} disabled={busy}>
                            {t('I’m continuing')}
                        </button>
                        {canStop(invoice) && (
                            <button type="button" className="tuLinkBtn" onClick={() => onStop(invoice)} disabled={busy}>
                                {t('Stop now')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </li>
    );
};

// A class they're in with no course running or billed (the studio is between routines).
const GapRow = ({ gap }) => {
    const { t, formatDate } = useI18n();
    return (
        <li className="tuRow isGap">
            <ClassThumb cls={{ id: gap.classId, name: gap.name, image_path: gap.image_path }} />
            <div className="tuRowMain">
                <strong>
                    <span className="tuRowTitle">{gap.name}</span>
                    <span className="tuPill">{t('Between courses')}</span>
                </strong>
                <small>
                    {gap.next
                        ? t('Next course: {course}, starts {date}. Its invoice shows up here soon.', { course: gap.next.title, date: formatDate(gap.next.starts_on, 'short') })
                        : t('No course running right now. The studio is planning the next one.')}
                </small>
            </div>
        </li>
    );
};

// The courses running now (and anything finished still open): paid, due, overdue or partly paid.
const NowCard = ({ view, today, busyId, onPay, onAnswer, onStop }) => {
    const { t, tn } = useI18n();
    const settled = view.live.filter((invoice) => ['paid', 'waived'].includes(invoice.status)).length;

    return (
        <SectionCard
            className="tuNowCard"
            icon={LuReceipt}
            title={t('Your courses')}
            subtitle={
                view.live.length
                    ? tn(view.live.length, '{paid} of {count} course paid', '{paid} of {count} courses paid', { paid: settled })
                    : t('No course running right now')
            }
            footer={
                <ul className="tuWays" aria-label={t('Ways to pay')}>
                    <li>
                        <LuQrCode aria-hidden="true" />
                        <span>
                            <strong>{t('QR bank transfer')}</strong>
                            {t('Turns to paid by itself within seconds.')}
                        </span>
                    </li>
                    <li>
                        <LuBanknote aria-hidden="true" />
                        <span>
                            <strong>{t('Cash at the desk')}</strong>
                            {t('The studio marks it paid for you.')}
                        </span>
                    </li>
                </ul>
            }
        >
            {view.current.length || view.gaps.length ? (
                <ul className="tuRows">
                    {view.current.map((invoice) => (
                        <InvoiceRow
                            key={invoice.id}
                            invoice={invoice}
                            all={view.all}
                            place={view.places.get(invoice.class_id)}
                            today={today}
                            busy={busyId === invoice.id}
                            onPay={onPay}
                            onAnswer={onAnswer}
                            onStop={onStop}
                        />
                    ))}
                    {view.gaps.map((gap) => (
                        <GapRow key={gap.classId} gap={gap} />
                    ))}
                </ul>
            ) : (
                <p className="pfEmptyLine">{t('Nothing billed right now.')}</p>
            )}
        </SectionCard>
    );
};

export default NowCard;
