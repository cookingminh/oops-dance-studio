import { useState } from 'react';
import { Avatar } from '@nextui-org/react';
import { LuAlertCircle, LuArrowRightLeft, LuBadgeCheck, LuCheck, LuCircleDashed, LuClock, LuCopy, LuHelpCircle, LuLogIn, LuLogOut, LuPhone, LuX } from 'react-icons/lu';
import { avatarUrl } from '@/services/storage';
import { useI18n } from '@/i18n/i18nContext';
import { AVATAR_DEFAULTS } from '@/ui/avatar';
import { RENEWAL, STATES } from './tuitionModel';

// Small pieces shared by the tuition page, its dialogs and the person panel.

const STATE_ICONS = { due: LuClock, partial: LuCircleDashed, overdue: LuAlertCircle, paid: LuBadgeCheck, waived: LuBadgeCheck, void: LuX, switched: LuArrowRightLeft };

// "Paid" / "Overdue" … with an icon, so the colour is never the only signal.
export const StatePill = ({ state }) => {
    const { t } = useI18n();
    const Icon = STATE_ICONS[state] ?? LuClock;
    return (
        <span className={`tuState is-${state}`}>
            <Icon aria-hidden="true" />
            {t(STATES[state]?.label ?? state)}
        </span>
    );
};

const RENEWAL_ICONS = { yes: LuCheck, no: LuX, none: LuHelpCircle };

// The student's answer for the month: continuing / stopping / no answer.
export const RenewalChip = ({ renewal }) => {
    const { t } = useI18n();
    const info = RENEWAL[renewal ?? 'none'];
    const Icon = RENEWAL_ICONS[info.tone];
    return (
        <span className={`tuRenewal is-${info.tone}`}>
            <Icon aria-hidden="true" />
            {t(info.label)}
        </span>
    );
};

// Avatar, name and a tap-to-call phone number (the invoice keeps the name if the account is gone).
export const StudentCell = ({ invoice, detail, size = 'sm' }) => {
    const student = invoice.student;
    const name = invoice.student_name || student?.full_name || student?.username || '—';
    const phone = student?.contact_number;
    return (
        <span className="tuWho">
            <Avatar {...AVATAR_DEFAULTS} size={size} src={avatarUrl(student?.avatar_path, student?.updated_at) ?? undefined} name={name} />
            <span className="tuWhoText">
                <strong>{name}</strong>
                {detail ?? (phone ? (
                    <a className="tuTel" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                        <LuPhone aria-hidden="true" />
                        {phone}
                    </a>
                ) : (
                    <small>{student?.email ?? ''}</small>
                ))}
            </span>
        </span>
    );
};

// A value with a copy button (codes, account numbers, the webhook URL…).
export const CopyValue = ({ value, label, mono = false, className = '' }) => {
    const { t } = useI18n();
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };
    return (
        <span className={`tuCopy ${mono ? 'isMono' : ''} ${className}`}>
            <span className="tuCopyValue">{value}</span>
            <button type="button" onClick={copy} aria-label={t('Copy {value}', { value: label ?? value })}>
                {copied ? <LuCheck aria-hidden="true" /> : <LuCopy aria-hidden="true" />}
                <span>{copied ? t('Copied') : t('Copy')}</span>
            </button>
        </span>
    );
};

// Dialog title for one invoice: the student, the class and the course.
export const InvoiceHead = ({ invoice, title }) => {
    const { monthName } = useI18n();
    const course = invoice.lesson_title || monthName(invoice.month, { withYear: true });
    return (
        <div className="tuDialogHead">
            <StudentCell invoice={invoice} size="md" detail={<small>{`${invoice.class_name} · ${course}`}</small>} />
            {title && <span className="tuDialogTitle">{title}</span>}
        </div>
    );
};

// Where a course stands, in a few words (`course` = courseFacts()):
//   running   "8 sessions (3 held) · until Wed 18 Nov"
//   planned   "Starts Sun 15 Nov · 8 sessions"
//   finished  "8 sessions · 1 October – 2 November"
// Shared with the student tuition page.
export const CourseFacts = ({ course }) => {
    const { tn, formatDate } = useI18n();
    const count = course?.session_count;
    if (count == null) return null;
    if (course.phase === 'planned') return tn(count, 'Starts {date} · {count} session', 'Starts {date} · {count} sessions', { date: formatDate(course.starts_on, 'short') });
    if (course.phase === 'current') {
        if (course.sessions_held == null) return tn(count, '{count} session', '{count} sessions');
        const vars = { held: course.sessions_held, date: formatDate(course.ends_on, 'short') };
        return course.ends_on
            ? tn(count, '{count} session ({held} held) · until {date}', '{count} sessions ({held} held) · until {date}', vars)
            : tn(count, '{count} session ({held} held)', '{count} sessions ({held} held)', vars);
    }
    const from = formatDate(course.starts_on, 'dayMonth');
    return course.ends_on
        ? tn(count, '{count} session · {from} – {to}', '{count} sessions · {from} – {to}', { from, to: formatDate(course.ends_on, 'dayMonth') })
        : tn(count, '{count} session · from {from}', '{count} sessions · from {from}', { from });
};

// "Leaves after Wed 18 Nov" (class switch: they finish their course first) or "Joins Sun 15 Nov"
// (enrolled from a later course). Nothing for an ordinary member.
export const PlaceTag = ({ place, today }) => {
    const { t, formatDate } = useI18n();
    if (place?.leaves_after) {
        return (
            <span className="tuPlaceTag isLeaving">
                <LuLogOut aria-hidden="true" />
                {t('Leaves after {date}', { date: formatDate(place.leaves_after, 'short') })}
            </span>
        );
    }
    if (place?.joined_at && today && place.joined_at > today) {
        return (
            <span className="tuPlaceTag isJoining">
                <LuLogIn aria-hidden="true" />
                {t('Joins {date}', { date: formatDate(place.joined_at, 'short') })}
            </span>
        );
    }
    return null;
};
