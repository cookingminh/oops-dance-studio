import { Link } from 'react-router-dom';
import {
    LuArrowRight,
    LuArrowRightLeft,
    LuBanknote,
    LuCalendarDays,
    LuHistory,
    LuLandmark,
    LuListChecks,
    LuMusic,
    LuPlay,
    LuQrCode,
    LuReceipt,
    LuUser,
    LuUserCheck,
} from 'react-icons/lu';
import { useI18n } from '@/i18n/i18nContext';
import { formatVnd } from '@/lib/format';
import { youtubeId, youtubeWatch } from '@/lib/youtube';
import { amountDue, invoiceState } from '@/services/tuition';
import { isSwitchedAway } from '../../../../../admin-staff/components/common/switch-class/switchNotes';
import { classHue } from '../../profileHelpers';
import { MovedTo, StatusPill } from '../tuition/TuitionParts';
import { studioDay } from '../tuition/tuitionData';
import { ClassThumb } from './ClassParts';
import { useShortDay } from './pastClassesData';

// Pieces of "Classes you've taken" (PastClasses.jsx). Styles: pastClassesDialog.scss (.pc*).

// Why a cancelled course was cancelled (the tuition page's words).
const VOID_NOTES = {
    stopped: 'You stopped this class.',
    removed: 'The studio took you off this class.',
    not_renewed: 'It wasn’t paid or answered in time, so your place ended.',
    class_ended: 'The class ended before this course.',
};

// Under a course: how and when it was paid, what is left, or why it was cancelled.
const MoneyNote = ({ row, all, today }) => {
    const { t, formatDate } = useI18n();
    const { invoice } = row;
    const state = invoiceState(invoice, today);
    const paid = Number(invoice.paid_amount);
    const lateJoin = invoice.sessions != null && row.total != null && Number(invoice.sessions) < Number(row.total);
    const late = lateJoin ? t('Joined late · paid for {left} of {count}', { left: invoice.sessions, count: row.total }) : null;

    let icon = null;
    let text = null;
    if (isSwitchedAway(invoice)) {
        icon = <LuArrowRightLeft aria-hidden="true" />;
        text = <MovedTo invoice={invoice} invoices={all} />;
    } else if (state === 'paid') {
        const day = studioDay(invoice.paid_at);
        const date = day ? formatDate(day, 'dayMonth') : null;
        icon = invoice.method === 'cash' ? <LuBanknote aria-hidden="true" /> : <LuLandmark aria-hidden="true" />;
        if (invoice.method === 'cash') text = date ? t('Paid in cash on {date}', { date }) : t('Cash');
        else text = date ? t('Paid by bank transfer on {date}', { date }) : t('Bank transfer');
    } else if (state === 'waived') {
        text = t('The studio waived this course. Enjoy!');
    } else if (state === 'partial') {
        text = t('You’ve paid {paid} of {amount}. Just {left} left.', { paid: formatVnd(paid), amount: formatVnd(invoice.amount), left: formatVnd(amountDue(invoice)) });
    } else if (state === 'overdue') {
        text = t('Was due {date}. Please pay when you can.', { date: formatDate(invoice.due_date, 'dayMonth') });
    } else if (VOID_NOTES[invoice.void_reason]) {
        text = t(VOID_NOTES[invoice.void_reason]);
    }
    if (!text && !late) return <span className="pcNote" />;
    return (
        <span className={`pcNote is-${state}`}>
            {icon}
            <span>
                {text}
                {text && late && ' · '}
                {late}
            </span>
        </span>
    );
};

// One course: the class, the song, the teacher, when it ran (and how many sessions they came to), and
// its tuition with the receipt, a Pay button while it's open and the class video once there is one.
export const CourseRow = ({ row, today, all, onReceipt, onPay }) => {
    const { t, tn } = useI18n();
    const shortDay = useShortDay();
    const { invoice } = row;
    const paid = Number(invoice.paid_amount);
    const isVoid = invoice.status === 'void';
    const videoId = youtubeId(row.videoUrl);
    const amount = isVoid ? (paid ? formatVnd(paid) : '—') : formatVnd(invoice.status === 'paid' ? paid : invoice.amount);
    const period = row.startsOn ? `${shortDay(row.startsOn)} – ${row.endsOn ? shortDay(row.endsOn) : '…'}` : null;
    let sessions = null;
    if (row.total != null) {
        sessions = row.isNow && row.held != null ? t('{held} of {total} sessions held', { held: row.held, total: row.total }) : tn(row.total, '{count} session', '{count} sessions');
    }
    const showCame = row.attended != null && (row.attended > 0 || !isVoid);

    return (
        <li className={`pcRow${isVoid ? ' isMuted' : ''}${row.isNow && !isVoid ? ' isNow' : ''}`} style={{ '--hue': classHue(row.image.id) }}>
            <ClassThumb cls={row.image} className="pcThumb" />
            <div className="pcMain">
                <p className="pcClassLine">
                    <strong className="pcClass">{row.className}</strong>
                    {row.isNow && !isVoid && (
                        <span className="pcNow">
                            <span className="pcNowDot" aria-hidden="true" />
                            {t('Now')}
                        </span>
                    )}
                </p>
                <p className="pcSong">
                    <LuMusic aria-hidden="true" />
                    <span>
                        <span className="pcSongTitle">{row.song || t('No routine yet')}</span>
                        {row.artist && <span className="pcArtist"> — {row.artist}</span>}
                    </span>
                </p>
                <ul className="pcFacts">
                    {row.teacher && (
                        <li className="pcTeacher">
                            {row.teacher.avatar ? <img src={row.teacher.avatar} alt="" /> : <LuUser aria-hidden="true" />}
                            <span>
                                {t('with')} <strong>{row.teacher.name}</strong>
                            </span>
                        </li>
                    )}
                    {period && (
                        <li>
                            <LuCalendarDays aria-hidden="true" /> {period}
                        </li>
                    )}
                    {sessions && (
                        <li>
                            <LuListChecks aria-hidden="true" /> {sessions}
                        </li>
                    )}
                    {showCame && (
                        <li className="pcCame">
                            <LuUserCheck aria-hidden="true" /> {tn(row.attended, 'You came to {count} session', 'You came to {count} sessions')}
                        </li>
                    )}
                </ul>
            </div>
            <div className="pcMoney">
                <strong className="pcAmount">{amount}</strong>
                <StatusPill invoice={invoice} today={today} />
            </div>
            <div className="pcFoot">
                <MoneyNote row={row} all={all} today={today} />
                <span className="pcActions">
                    {videoId && (
                        <a
                            className="pcAction isVideo"
                            href={youtubeWatch(videoId)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t('Watch the class video of “{title}”', { title: invoice.course.title || row.song })}
                        >
                            <LuPlay aria-hidden="true" /> {t('Video')}
                        </a>
                    )}
                    {(!isVoid || paid > 0) && (
                        <button type="button" className="pcAction" onClick={() => onReceipt(row)}>
                            <LuReceipt aria-hidden="true" /> {t('Receipt')}
                        </button>
                    )}
                    {invoice.status === 'unpaid' && (
                        <button type="button" className="pcAction isPrimary" onClick={() => onPay(invoice)}>
                            <LuQrCode aria-hidden="true" /> {t('Pay {amount}', { amount: formatVnd(amountDue(invoice)) })}
                        </button>
                    )}
                </span>
            </div>
        </li>
    );
};

// Placeholder months while the courses load (the same shimmer as the rest of the profile).
export const PastSkeleton = () => {
    const { t } = useI18n();
    return (
        <div className="pcSkeleton" role="status" aria-label={t('Loading…')}>
            {[0, 1].map((group) => (
                <div key={group} className="pcSkelGroup" aria-hidden="true">
                    <span className="pcSkelHead" />
                    {[0, 1].map((index) => (
                        <div key={index} className="pcSkelRow">
                            <span className="pcSkelThumb" />
                            <span className="pcSkelLines">
                                <span style={{ width: `${46 - index * 8}%` }} />
                                <span style={{ width: `${68 - group * 10}%` }} />
                                <span style={{ width: `${54 + index * 6}%` }} />
                            </span>
                            <span className="pcSkelMoney">
                                <span />
                                <span />
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

// Nothing has started yet.
export const PastEmpty = () => {
    const { t } = useI18n();
    return (
        <div className="pcEmpty">
            <span className="pcEmptyArt" aria-hidden="true">
                <LuHistory />
            </span>
            <strong>{t('Your dance story starts here')}</strong>
            <p>{t('Every course you take shows up here with its song, teacher and receipt.')}</p>
            <Link to="/classes" className="pcAction isPrimary">
                {t('Explore classes')} <LuArrowRight aria-hidden="true" />
            </Link>
        </div>
    );
};
