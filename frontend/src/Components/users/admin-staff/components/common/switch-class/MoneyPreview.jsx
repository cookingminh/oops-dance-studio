import { Link } from 'react-router-dom';
import { LuAlertTriangle, LuArrowRight, LuArrowRightLeft, LuCalendarCheck, LuCalendarClock, LuInfo, LuWallet } from 'react-icons/lu';
import { formatVnd } from '@/lib/format';
import { useI18n } from '@/i18n/i18nContext';
import { classPath } from '../../body/class-hub/hubModel';
import RichText from './RichText';
import { resultOf } from './switchModel';

const b = (text) => <strong>{text}</strong>;

// What happens to the course they're in (old class): it stays, paid or still owed — no refund.
function keepLine(preview, fromName, { t, formatDate }) {
    const { keep } = preview;
    if (!keep) return { icon: LuCalendarCheck, text: t('Nothing is running in {from}: they leave it today.'), vars: { from: b(fromName) } };
    const invoice = keep.invoice;
    const vars = {
        course: b(keep.title),
        from: b(fromName),
        date: b(formatDate(keep.ends_on ?? preview.leaveOn, 'short')),
        paid: b(formatVnd(invoice?.paid_amount)),
        amount: b(formatVnd(invoice?.amount)),
    };
    if (!invoice || invoice.status === 'void') return { icon: LuCalendarCheck, text: t('They keep dancing {course} until {date}.'), vars };
    if (invoice.status === 'paid') return { icon: LuWallet, text: t('{course} is paid ({paid}): it stays with {from}, no refund. They keep dancing until {date}.'), vars };
    if (invoice.status === 'waived') return { icon: LuWallet, text: t('{course} was waived. They keep dancing until {date}.'), vars };
    if (Number(invoice.paid_amount) > 0) return { icon: LuWallet, text: t('{paid} of {amount} is paid for {course}: the rest is still owed to {from}. They keep dancing until {date}.'), vars };
    return { icon: LuWallet, text: t('{course} isn’t paid yet ({amount}): that stays to pay in {from}. They keep dancing until {date}.'), vars };
}

// What the new course costs them after the money that moves.
function feeLine(preview, settings, t) {
    const { target, fee, movedTotal } = preview;
    const vars = {
        next: b(target.title),
        fee: b(formatVnd(fee.amount)),
        full: b(formatVnd(fee.full)),
        left: b(formatVnd(preview.due)),
        extra: b(formatVnd(preview.extra)),
        sessions: fee.left,
        count: target.session_count,
        due: settings?.due_session ?? 2,
    };
    if (fee.prorated) return { text: t('{next} is already running: {sessions} of {count} sessions left, so {fee} instead of {full}.'), vars };
    if (preview.extra > 0) return { text: t('{next} costs {fee}, so {extra} is extra: noted on the invoice, to refund or keep as credit.'), vars };
    if (movedTotal > 0) return { text: preview.due ? t('{next} costs {fee} → {left} left to pay.') : t('{next} costs {fee} → nothing left to pay.'), vars };
    return { text: t('{next} costs {fee}, to pay by its session {due}.'), vars };
}

// Step 2 of "Switch class": what happens, in words and as a small "from → to" picture. Mirrors the
// server (switchModel.switchPreview): they finish the course they're in, then join the new class
// from its next course; money moves only from the old class's next course if it was already paid.
const MoneyPreview = ({ preview, settings, studentName, fromName, toClass }) => {
    const i18n = useI18n();
    const { t, tn, formatDate } = i18n;
    const toName = toClass.name;

    if (preview.blocked) {
        return (
            <section className="swStep" aria-labelledby="sw-money">
                <h3 id="sw-money" className="swStepLabel">
                    <span className="swStepNo" aria-hidden="true">
                        2
                    </span>
                    {t('What happens next')}
                </h3>
                <div className="swBlocked" role="note">
                    <LuAlertTriangle aria-hidden="true" />
                    <p>
                        <strong>{t('{className} has no upcoming course to join yet.', { className: toName })}</strong>
                        <span>{t('Plan its next course first (the song, start date and fee), then switch: students join a class from the start of a course.')}</span>
                        <Link className="swPlanLink" to={classPath(toClass.id, { tab: 'routines' })}>
                            {t('Plan the next course')} <LuArrowRight aria-hidden="true" />
                        </Link>
                    </p>
                </div>
            </section>
        );
    }

    const { keep, target, fee } = preview;
    const result = resultOf(preview);
    const start = formatDate(target.starts_on, 'short');
    const lastDay = formatDate(preview.leaveOn, 'short');
    const summaryVars = {
        name: studentName,
        course: b(keep?.title ?? ''),
        from: b(fromName),
        date: lastDay,
        to: b(toName),
        next: b(target.title),
        start,
        fee: formatVnd(fee.amount),
    };
    let summary;
    if (keep) {
        summary = target.starts_on > preview.leaveOn
            ? t('{name} finishes {course} in {from} (last session {date}), then joins {to} from {next} (starts {start} · {fee}).')
            : t('{name} finishes {course} in {from} (last session {date}) and joins {to} from {next} (starts {start} · {fee}).');
    } else {
        summary = target.late
            ? t('{name} leaves {from} today (no course is running there) and joins {to} in {next}, which is already running ({fee}).')
            : t('{name} leaves {from} today (no course is running there) and joins {to} from {next} (starts {start} · {fee}).');
    }
    const kept = keepLine(preview, fromName, i18n);
    const costs = feeLine(preview, settings, t);

    return (
        <section className="swStep" aria-labelledby="sw-money">
            <h3 id="sw-money" className="swStepLabel">
                <span className="swStepNo" aria-hidden="true">
                    2
                </span>
                {t('What happens next')}
            </h3>
            <p className="swSummary">
                <RichText text={summary} vars={summaryVars} />
            </p>

            {/* From → to, at a glance. */}
            <div className="swPath">
                <div className="swEnd isFrom">
                    <small>{keep ? t('Finishes') : t('Leaves today')}</small>
                    <strong>{fromName}</strong>
                    {keep && <span className="swEndCourse">{keep.title}</span>}
                    <span className="swEndDate">
                        <LuCalendarCheck aria-hidden="true" />
                        {keep ? t('Last session {date}', { date: lastDay }) : t('Today')}
                    </span>
                </div>
                <span className="swArrow" aria-hidden="true">
                    <LuArrowRight />
                </span>
                <div className={`swEnd isTo tone-${result.tone}`}>
                    <small>{target.late ? t('Joins, already running') : t('Joins from')}</small>
                    <strong>{toName}</strong>
                    <span className="swEndCourse">{target.title}</span>
                    <span className="swEndDate">
                        <LuCalendarClock aria-hidden="true" />
                        {target.late ? t('From today') : t('Starts {date}', { date: start })}
                    </span>
                    <span className="swResult">{t(result.key, result.amount !== undefined ? { amount: formatVnd(result.amount) } : undefined)}</span>
                </div>
            </div>

            <ul className="swLines">
                <li className="swLine">
                    <kept.icon aria-hidden="true" />
                    <span>
                        <RichText text={kept.text} vars={kept.vars} />
                    </span>
                </li>
                {preview.moved.map((row) => (
                    <li key={row.id} className="swLine">
                        <LuArrowRightLeft aria-hidden="true" />
                        <span>
                            <RichText
                                text={
                                    row.paid > 0
                                        ? t('Paid {paid} for {course}, the next course in {from} → it moves to {next}.')
                                        : t('{course}, the next course in {from}, is cancelled (nothing was paid on it).')
                                }
                                vars={{ paid: b(formatVnd(row.paid)), course: b(row.title), from: b(fromName), next: b(target.title) }}
                            />
                        </span>
                    </li>
                ))}
                <li className="swLine">
                    <LuWallet aria-hidden="true" />
                    <span>
                        <RichText text={costs.text} vars={costs.vars} />
                    </span>
                </li>
            </ul>

            {preview.earlierUnpaid.length > 0 && (
                <p className="swFine">
                    <LuInfo aria-hidden="true" />
                    <span>
                        {tn(preview.earlierUnpaid.length, '{count} unpaid invoice of an earlier course stays with {className}.', '{count} unpaid invoices of earlier courses stay with {className}.', {
                            className: fromName,
                        })}
                    </span>
                </p>
            )}
        </section>
    );
};

export default MoneyPreview;
